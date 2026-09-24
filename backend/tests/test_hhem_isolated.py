"""Isolated test for Vectara HHEM (vectara/hallucination_evaluation_model).

Verifies that the Hugging Face model downloads/loads properly, performs real inference,
and correctly discriminates between a factually consistent response and a hallucinated response.
"""
import sys
import os

# Add backend directory to sys.path so app modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import asyncio
from app.evaluators.hallucination import VectaraHallucinationEvaluator


@pytest.mark.asyncio
async def test_hhem_isolated_factual_vs_hallucination():
    print("\n--- Starting Isolated Vectara HHEM Test ---")
    evaluator = VectaraHallucinationEvaluator(
        model_name="vectara/hallucination_evaluation_model",
        device="auto"
    )

    print("Step 1: Loading model into memory...")
    evaluator.load_model()
    assert evaluator.is_loaded is True
    print(f"Model loaded successfully on device: {evaluator._device}")

    reference = "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It was completed in 1889 for the Exposition Universelle."
    
    # Case A: High factual consistency
    consistent_response = "The Eiffel Tower was completed in 1889 in Paris, France for the Exposition Universelle."
    result_a = await evaluator.evaluate(
        prompt="When and where was the Eiffel Tower built?",
        chatbot_response=consistent_response,
        reference_evidence=reference
    )
    print(f"\n[Case A - Factual] Raw Score: {result_a.raw_score} | Risk: {result_a.risk_level}")
    print(f"Details: {result_a.details}")

    # Case B: Direct hallucination / factual contradiction
    hallucinated_response = "The Eiffel Tower was constructed in Rome, Italy in 1975 to serve as a television broadcast antenna."
    result_b = await evaluator.evaluate(
        prompt="When and where was the Eiffel Tower built?",
        chatbot_response=hallucinated_response,
        reference_evidence=reference
    )
    print(f"\n[Case B - Hallucinated] Raw Score: {result_b.raw_score} | Risk: {result_b.risk_level}")
    print(f"Details: {result_b.details}")

    # Assertions
    assert result_a.status == "evaluated"
    assert result_b.status == "evaluated"
    assert result_a.raw_score is not None
    assert result_b.raw_score is not None
    assert 0.0 <= result_a.raw_score <= 1.0
    assert 0.0 <= result_b.raw_score <= 1.0

    # The factually consistent response MUST score significantly higher than the hallucinated response
    assert result_a.raw_score > result_b.raw_score, (
        f"Expected factual score ({result_a.raw_score}) > hallucinated score ({result_b.raw_score})"
    )
    assert result_a.risk_level == "low", f"Expected 'low' risk for factual text, got {result_a.risk_level}"
    assert result_b.risk_level == "high", f"Expected 'high' risk for hallucinated text, got {result_b.risk_level}"

    print("\n--- Isolated HHEM Verification Passed Successfully! ---\n")


if __name__ == "__main__":
    asyncio.run(test_hhem_isolated_factual_vs_hallucination())
