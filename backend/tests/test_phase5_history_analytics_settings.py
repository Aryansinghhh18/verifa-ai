"""Test suite for Phase 5: Evaluation History, Analytics, Report Export & Settings."""
import os
import sys
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app, lifespan


@pytest.mark.asyncio
async def test_evaluation_history_filtering_sorting_and_export():
    """Verifies that history returns user-isolated evaluations with search, filters, pagination, and CSV export."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            user_a_email = f"hist_a_{uuid.uuid4().hex[:8]}@verifa.ai"
            user_b_email = f"hist_b_{uuid.uuid4().hex[:8]}@verifa.ai"

            # Register User A
            res_a = await client.post("/api/v1/auth/register", json={
                "email": user_a_email,
                "password": "Password123!",
                "full_name": "User History A"
            })
            assert res_a.status_code == 201
            token_a = res_a.json()["access_token"]
            headers_a = {"Authorization": f"Bearer {token_a}"}

            # Register User B (for isolation test)
            res_b = await client.post("/api/v1/auth/register", json={
                "email": user_b_email,
                "password": "Password123!",
                "full_name": "User History B"
            })
            assert res_b.status_code == 201
            token_b = res_b.json()["access_token"]
            headers_b = {"Authorization": f"Bearer {token_b}"}

            # Check initial empty history for User A
            res_hist_empty = await client.get("/api/v1/evaluations/history", headers=headers_a)
            assert res_hist_empty.status_code == 200
            assert res_hist_empty.json()["total_count"] == 0
            assert len(res_hist_empty.json()["items"]) == 0

            # Upload batch evaluation for User A with 2 rows
            csv_content_a = (
                'prompt,response,reference\n'
                '"History Question Alpha","Answer Alpha is factually grounded.","Answer Alpha is factually grounded."\n'
                '"History Question Beta","Answer Beta is factually wrong.","Answer Beta is factually grounded."\n'
            ).encode("utf-8")

            files_a = {"file": ("dataset_a.csv", csv_content_a, "text/csv")}
            res_upload = await client.post("/api/v1/batch/upload", files=files_a, headers=headers_a)
            assert res_upload.status_code == 202

            # Query History for User A
            res_hist = await client.get("/api/v1/evaluations/history", headers=headers_a)
            assert res_hist.status_code == 200
            hist_data = res_hist.json()
            assert hist_data["total_count"] == 2
            assert len(hist_data["items"]) == 2
            assert hist_data["items"][0]["evaluation_type"] == "batch"

            # Verify User B sees 0 evaluations (Strict multi-tenant isolation)
            res_hist_b = await client.get("/api/v1/evaluations/history", headers=headers_b)
            assert res_hist_b.status_code == 200
            assert res_hist_b.json()["total_count"] == 0

            # Test Search filter: search="Alpha"
            res_search = await client.get("/api/v1/evaluations/history?search=Alpha", headers=headers_a)
            assert res_search.status_code == 200
            search_data = res_search.json()
            assert search_data["total_count"] == 1
            assert "Alpha" in search_data["items"][0]["prompt"]

            # Test Evaluation Type filter: type="batch" vs "single"
            res_type_batch = await client.get("/api/v1/evaluations/history?evaluation_type=batch", headers=headers_a)
            assert res_type_batch.json()["total_count"] == 2

            res_type_single = await client.get("/api/v1/evaluations/history?evaluation_type=single", headers=headers_a)
            assert res_type_single.json()["total_count"] == 0

            # Test Sorting by score: score_desc
            res_sort = await client.get("/api/v1/evaluations/history?sort_by=score_desc", headers=headers_a)
            assert res_sort.status_code == 200
            sorted_items = res_sort.json()["items"]
            assert sorted_items[0]["hallucination_score"] >= sorted_items[1]["hallucination_score"]

            # Test CSV Export
            res_export = await client.get("/api/v1/evaluations/export", headers=headers_a)
            assert res_export.status_code == 200
            assert "text/csv" in res_export.headers.get("content-type", "")
            export_text = res_export.text
            assert "Evaluation ID,Date (UTC),Chatbot Name" in export_text
            assert "History Question Alpha" in export_text
            assert "History Question Beta" in export_text


@pytest.mark.asyncio
async def test_analytics_overview_aggregation():
    """Verifies analytics endpoint computes accurate aggregate metrics and trends from stored data."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            user_email = f"analytics_{uuid.uuid4().hex[:8]}@verifa.ai"

            # Register
            res_reg = await client.post("/api/v1/auth/register", json={
                "email": user_email,
                "password": "Password123!",
                "full_name": "Analytics Tester"
            })
            token = res_reg.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}

            # 1. Check empty state (0 evaluations)
            res_overview_empty = await client.get("/api/v1/analytics/overview?time_filter=30d", headers=auth_headers)
            assert res_overview_empty.status_code == 200
            data_empty = res_overview_empty.json()
            assert data_empty["total_evaluations"] == 0
            assert data_empty["average_hhem_score"] is None
            assert data_empty["average_latency_ms"] is None
            assert data_empty["risk_breakdown"]["low"] == 0

            # 2. Upload evaluation cases
            csv_content = (
                'prompt,response,reference\n'
                '"Q1","The sun is a star.","The sun is the star at the center of the Solar System."\n'
                '"Q2","The sun is made of solid ice.","The sun is composed primarily of hydrogen and helium plasma."\n'
            ).encode("utf-8")
            files = {"file": ("analytics_dataset.csv", csv_content, "text/csv")}
            await client.post("/api/v1/batch/upload", files=files, headers=auth_headers)

            # 3. Check overview with populated evaluations
            res_overview = await client.get("/api/v1/analytics/overview?time_filter=30d", headers=auth_headers)
            assert res_overview.status_code == 200
            data = res_overview.json()
            assert data["total_evaluations"] == 2
            assert data["average_hhem_score"] is not None
            assert 0.0 <= data["average_hhem_score"] <= 1.0
            assert data["failed_evaluations"] == 0
            assert (data["risk_breakdown"]["low"] + data["risk_breakdown"]["high"] + data["risk_breakdown"]["medium"]) == 2
            assert len(data["evaluations_over_time"]) >= 1


@pytest.mark.asyncio
async def test_user_settings_profile_and_password_update():
    """Verifies profile update and password change in settings."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            user_email = f"settings_{uuid.uuid4().hex[:8]}@verifa.ai"

            # Register
            res_reg = await client.post("/api/v1/auth/register", json={
                "email": user_email,
                "password": "OldPassword123!",
                "full_name": "Original Name"
            })
            token = res_reg.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}

            # Update Profile
            res_profile = await client.put(
                "/api/v1/auth/profile",
                json={"full_name": "Updated Engineer Name"},
                headers=auth_headers
            )
            assert res_profile.status_code == 200
            assert res_profile.json()["full_name"] == "Updated Engineer Name"

            # Verify GET /me reflects updated name
            res_me = await client.get("/api/v1/auth/me", headers=auth_headers)
            assert res_me.json()["full_name"] == "Updated Engineer Name"

            # Attempt password change with wrong old password
            res_wrong_pw = await client.post(
                "/api/v1/auth/change-password",
                json={"current_password": "WrongPassword!", "new_password": "NewPassword123!"},
                headers=auth_headers
            )
            assert res_wrong_pw.status_code == 400

            # Successful password change
            res_change_pw = await client.post(
                "/api/v1/auth/change-password",
                json={"current_password": "OldPassword123!", "new_password": "NewPassword123!"},
                headers=auth_headers
            )
            assert res_change_pw.status_code == 200

            # Verify login with new password works
            res_login = await client.post("/api/v1/auth/login", json={
                "email": user_email,
                "password": "NewPassword123!"
            })
            assert res_login.status_code == 200
            assert "access_token" in res_login.json()
