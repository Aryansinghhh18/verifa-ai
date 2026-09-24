"""Comprehensive test suite for Phase 4: Batch Evaluation & CSV Processing.

Verifies:
1. CSV validation & parsing (valid CSV, missing columns, empty files, malformed rows).
2. End-to-end batch evaluation upload & background processing.
3. HHEM integration through the existing Phase 3 engine.
4. Batch progress polling and summary generation.
5. Report generation and CSV export download.
"""
import sys
import os
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app, lifespan
from app.services.batch_service import validate_and_parse_csv, BatchService


def test_csv_validation_and_parsing_unit():
    """Unit tests for CSV parsing logic."""
    # 1. Valid standard CSV with prompt,response
    csv_valid = (
        'prompt,response\n'
        '"What is the capital of France?","Paris is the capital of France."\n'
        '"Who invented the internet?","The internet was invented by many researchers."\n'
    ).encode("utf-8")
    rows = validate_and_parse_csv(csv_valid)
    assert len(rows) == 2
    assert rows[0]["prompt"] == "What is the capital of France?"
    assert rows[0]["response"] == "Paris is the capital of France."
    assert rows[0]["reference"] is None

    # 2. Valid CSV with optional reference column
    csv_with_ref = (
        'question,answer,evidence\n'
        '"When was Eiffel Tower built?","Completed in 1889.","Built for 1889 Exposition."\n'
    ).encode("utf-8")
    rows_ref = validate_and_parse_csv(csv_with_ref)
    assert len(rows_ref) == 1
    assert rows_ref[0]["prompt"] == "When was Eiffel Tower built?"
    assert rows_ref[0]["response"] == "Completed in 1889."
    assert rows_ref[0]["reference"] == "Built for 1889 Exposition."

    # 3. Empty CSV should raise ValueError
    with pytest.raises(ValueError, match="empty"):
        validate_and_parse_csv(b"")

    # 4. Missing required column
    with pytest.raises(ValueError, match="Missing required columns"):
        validate_and_parse_csv(b"header1,header2\nfoo,bar\n")

    # 5. Row with empty prompt
    with pytest.raises(ValueError, match="empty prompt"):
        validate_and_parse_csv(b'prompt,response\n"",valid answer\n')


@pytest.mark.asyncio
async def test_end_to_end_batch_processing_and_export():
    """Integration test: Uploads a CSV, processes batch evaluations with HHEM, checks summary, and exports CSV."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            test_email = f"batch_user_{uuid.uuid4().hex[:8]}@verifa.ai"

            # 1. Register User & Auth
            res_reg = await client.post("/api/v1/auth/register", json={
                "email": test_email,
                "password": "Password123!",
                "full_name": "Batch Tester"
            })
            assert res_reg.status_code == 201
            token = res_reg.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}

            # 2. Upload CSV with 2 test cases
            csv_content = (
                'prompt,response,reference\n'
                '"Where is Eiffel Tower?","The Eiffel Tower is in Paris, France.","The Eiffel Tower is located in Paris, France."\n'
                '"Where is Eiffel Tower?","The Eiffel Tower is located in Rome, Italy.","The Eiffel Tower is located in Paris, France."\n'
            ).encode("utf-8")

            files = {
                "file": ("test_cases.csv", csv_content, "text/csv")
            }
            res_upload = await client.post(
                "/api/v1/batch/upload",
                files=files,
                headers=auth_headers
            )
            assert res_upload.status_code == 202
            job_data = res_upload.json()
            job_id = job_data["id"]
            assert job_data["total_cases"] == 2
            # Background task executes automatically with ASGITransport.
            # 3. Check Progress Endpoint
            res_progress = await client.get(f"/api/v1/batch/{job_id}/progress", headers=auth_headers)
            assert res_progress.status_code == 200
            prog_data = res_progress.json()
            assert prog_data["total_cases"] == 2
            assert prog_data["completed_cases"] == 2
            assert prog_data["status"] == "completed"
            assert prog_data["progress_percentage"] == 100.0

            # 4. Check Detail Endpoint & Summary Analytics
            res_detail = await client.get(f"/api/v1/batch/{job_id}", headers=auth_headers)
            assert res_detail.status_code == 200
            detail_data = res_detail.json()
            assert detail_data["total_cases"] == 2
            assert detail_data["completed_cases"] == 2
            assert detail_data["failed_cases"] == 0
            assert len(detail_data["results"]) == 2

            # Verify real HHEM discrimination inside batch:
            row_factual = detail_data["results"][0]
            row_hallucinated = detail_data["results"][1]
            assert row_factual["hhem_score"] is not None
            assert row_hallucinated["hhem_score"] is not None
            assert row_factual["hhem_score"] > row_hallucinated["hhem_score"]
            assert row_factual["risk_level"] == "low"
            assert row_hallucinated["risk_level"] == "high"

            summary = detail_data["summary"]
            assert summary["total_cases"] == 2
            assert summary["average_hhem_score"] is not None
            assert summary["low_risk_count"] == 1
            assert summary["high_risk_count"] == 1

            # 5. Export / Download CSV Report
            res_export = await client.get(f"/api/v1/batch/{job_id}/export", headers=auth_headers)
            assert res_export.status_code == 200
            assert "text/csv" in res_export.headers.get("content-type", "")
            csv_text = res_export.text
            assert "row_index,prompt,response,reference,hhem_consistency_score,risk_level,status,error_message" in csv_text
            assert "The Eiffel Tower is in Paris" in csv_text
            assert "low" in csv_text
            assert "high" in csv_text


@pytest.mark.asyncio
async def test_batch_upload_invalid_file_handling():
    """Tests proper error responses when uploading non-csv or malformed content."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            test_email = f"batch_err_{uuid.uuid4().hex[:8]}@verifa.ai"
            res_reg = await client.post("/api/v1/auth/register", json={
                "email": test_email,
                "password": "Password123!",
                "full_name": "Error Tester"
            })
            auth_headers = {"Authorization": f"Bearer {res_reg.json()['access_token']}"}

            # Non-csv extension
            res_bad_ext = await client.post(
                "/api/v1/batch/upload",
                files={"file": ("dataset.json", b'{"key": "val"}', "application/json")},
                headers=auth_headers
            )
            assert res_bad_ext.status_code == 400
            assert "Only CSV" in res_bad_ext.json()["detail"]

            # Empty CSV
            res_empty = await client.post(
                "/api/v1/batch/upload",
                files={"file": ("empty.csv", b"", "text/csv")},
                headers=auth_headers
            )
            assert res_empty.status_code == 400
            assert "empty" in res_empty.json()["detail"].lower()
