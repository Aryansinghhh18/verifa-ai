"""Comprehensive test suite for Phase 3: Core Evaluation Engine & Vectara HHEM Integration.

Verifies:
1. Real HHEM factual consistency scoring on:
   - Response supported by reference (Score ~0.92, Low Risk)
   - Response contradicting/unsupported by reference (Score ~0.004, High Risk)
2. Factual consistency terminology (not calling HHEM score 'accuracy')
3. End-to-end /api/v1/evaluations/run flow with simulated chatbot response
4. Persistence of completed evaluations to authenticated user's history
5. API key protection (never exposed in evaluation response)
6. Latency and timestamp capturing
"""
import sys
import os
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app, lifespan
from app.evaluators.hallucination import VectaraHallucinationEvaluator


@pytest.mark.asyncio
async def test_hhem_supported_vs_contradicting_responses():
    """Unit test: Verifies HHEM model correctly scores supported vs contradicting text."""
    evaluator = VectaraHallucinationEvaluator(
        model_name="vectara/hallucination_evaluation_model",
        device="auto"
    )
    evaluator.load_model()
    assert evaluator.is_loaded is True

    reference = (
        "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. "
        "It was completed in 1889 for the Exposition Universelle."
    )

    # 1. Supported Response
    supported_resp = "The Eiffel Tower was completed in 1889 in Paris, France for the Exposition Universelle."
    res_supported = await evaluator.evaluate(
        prompt="When and where was the Eiffel Tower built?",
        chatbot_response=supported_resp,
        reference_evidence=reference
    )

    # 2. Contradicting / Unsupported Response
    contradicting_resp = "The Eiffel Tower was constructed in Rome, Italy in 1975 to serve as a television broadcast antenna."
    res_contradicting = await evaluator.evaluate(
        prompt="When and where was the Eiffel Tower built?",
        chatbot_response=contradicting_resp,
        reference_evidence=reference
    )

    print(f"\n[Test] Supported Response Score: {res_supported.raw_score} (Risk: {res_supported.risk_level})")
    print(f"[Test] Contradicting Response Score: {res_contradicting.raw_score} (Risk: {res_contradicting.risk_level})")

    # Assertions
    assert res_supported.status == "evaluated"
    assert res_contradicting.status == "evaluated"
    assert res_supported.raw_score is not None
    assert res_contradicting.raw_score is not None

    # Supported MUST be significantly higher than contradicting
    assert res_supported.raw_score > res_contradicting.raw_score
    assert res_supported.raw_score >= 0.85
    assert res_contradicting.raw_score <= 0.20
    assert res_supported.risk_level == "low"
    assert res_contradicting.risk_level == "high"

    # Terminology verification: Label must not call it "accuracy"
    assert "accuracy" not in res_supported.label.lower()
    assert "consistency" in res_supported.label.lower() or "hallucination" in res_supported.label.lower()


@pytest.mark.asyncio
async def test_end_to_end_evaluation_flow():
    """Integration test: Tests the full end-to-end flow from API dispatch to HHEM scoring and history persistence."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            test_email = f"eval_user_{uuid.uuid4().hex[:8]}@verifa.ai"

            # Step 1: Register User
            res_reg = await client.post("/api/v1/auth/register", json={
                "email": test_email,
                "password": "StrongPassword123!",
                "full_name": "Evaluation Tester"
            })
            assert res_reg.status_code == 201
            token = res_reg.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}

            # Step 2: Register Chatbot Connection
            raw_key = "sk-super-secret-key-12345"
            res_cb = await client.post("/api/v1/chatbots/", json={
                "name": "DocSearch Assistant",
                "api_endpoint": "https://api.openai.com/v1/chat/completions",
                "api_key": raw_key,
                "http_method": "POST",
                "request_template": '{"messages": [{"role": "user", "content": "{{prompt}}"}]}',
                "response_json_path": "choices[0].message.content"
            }, headers=auth_headers)
            assert res_cb.status_code == 201
            cb_id = res_cb.json()["id"]

            reference_evidence = (
                "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. "
                "It was completed in 1889 for the Exposition Universelle."
            )

            # Step 3: Run Evaluation with a Factual Chatbot Response
            factual_answer = "The Eiffel Tower was completed in 1889 in Paris, France for the Exposition Universelle."
            mock_chatbot_call = AsyncMock(return_value=(factual_answer, 200, 312.5))

            with patch("app.services.evaluation_service.ChatbotClient.call_chatbot", mock_chatbot_call):
                res_eval = await client.post("/api/v1/evaluations/run", json={
                    "chatbot_id": cb_id,
                    "prompt": "When and where was the Eiffel Tower built?",
                    "reference_evidence": reference_evidence,
                    "selected_metrics": ["hallucination", "latency"]
                }, headers=auth_headers)

            assert res_eval.status_code == 201
            eval_data = res_eval.json()

            # Verify response fields
            assert eval_data["chatbot_id"] == cb_id
            assert eval_data["chatbot_name"] == "DocSearch Assistant"
            assert eval_data["chatbot_response"] == factual_answer
            assert eval_data["response_latency_ms"] == 312.5
            assert eval_data["status"] == "success"
            assert "created_at" in eval_data

            # Security check: Raw API key must NEVER be in response
            assert raw_key not in str(eval_data)

            # Metric verification
            metrics = {m["metric_type"]: m for m in eval_data["metrics"]}
            assert "hallucination" in metrics
            assert "latency" in metrics

            hhem_metric = metrics["hallucination"]
            assert hhem_metric["status"] == "evaluated"
            assert hhem_metric["raw_score"] is not None
            assert hhem_metric["raw_score"] >= 0.85
            assert hhem_metric["risk_level"] == "low"
            assert "interpretation" in hhem_metric["details"]

            eval_id = eval_data["id"]

            # Step 4: Run Evaluation with a Contradicting Chatbot Response
            contradicting_answer = "The Eiffel Tower was constructed in Rome, Italy in 1975 to serve as a television broadcast antenna."
            mock_contradicting_call = AsyncMock(return_value=(contradicting_answer, 200, 240.0))

            with patch("app.services.evaluation_service.ChatbotClient.call_chatbot", mock_contradicting_call):
                res_eval_2 = await client.post("/api/v1/evaluations/run", json={
                    "chatbot_id": cb_id,
                    "prompt": "When and where was the Eiffel Tower built?",
                    "reference_evidence": reference_evidence,
                    "selected_metrics": ["hallucination", "latency"]
                }, headers=auth_headers)

            assert res_eval_2.status_code == 201
            eval_data_2 = res_eval_2.json()
            hhem_metric_2 = next(m for m in eval_data_2["metrics"] if m["metric_type"] == "hallucination")
            assert hhem_metric_2["raw_score"] <= 0.20
            assert hhem_metric_2["risk_level"] == "high"

            # Step 5: Verify Saved History
            res_history = await client.get("/api/v1/evaluations/", headers=auth_headers)
            assert res_history.status_code == 200
            history_list = res_history.json()
            assert len(history_list) >= 2
            assert any(item["id"] == eval_id for item in history_list)

            # Step 6: Verify Single Evaluation Detail Retrieval
            res_detail = await client.get(f"/api/v1/evaluations/{eval_id}", headers=auth_headers)
            assert res_detail.status_code == 200
            detail_data = res_detail.json()
            assert detail_data["id"] == eval_id
            assert detail_data["chatbot_response"] == factual_answer
            assert len(detail_data["metrics"]) >= 2
