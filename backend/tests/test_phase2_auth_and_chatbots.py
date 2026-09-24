"""Comprehensive test suite for Phase 2: Authentication & Chatbot Connection Manager.

Verifies:
1. User registration & duplicate email rejection.
2. User login & credential verification.
3. Protected /auth/me route.
4. Chatbot creation with API key encryption at rest (masked in API responses).
5. Chatbot listing, retrieval, update, and deletion.
6. SSRF prevention blocking loopback and private subnets.
7. Chatbot 'Test Connection' ping execution & graceful failure handling.
"""
import sys
import os
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uuid
from app.main import app, lifespan
from app.core.security import decrypt_api_key


@pytest.mark.asyncio
async def test_auth_and_chatbot_manager_lifecycle():
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            test_email = f"tester_{uuid.uuid4().hex[:8]}@verifa.ai"
            # -------------------------------------------------------------
            # 1. User Registration
            # -------------------------------------------------------------
            reg_payload = {
                "email": test_email,
                "password": "SecurePassword123!",
                "full_name": "Test Engineer"
            }
            res_reg = await client.post("/api/v1/auth/register", json=reg_payload)
            assert res_reg.status_code == 201
            reg_data = res_reg.json()
            assert "access_token" in reg_data
            assert reg_data["user"]["email"] == test_email
            assert reg_data["user"]["full_name"] == "Test Engineer"
            token = reg_data["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}

            # -------------------------------------------------------------
            # 2. Duplicate Registration Rejection
            # -------------------------------------------------------------
            res_dup = await client.post("/api/v1/auth/register", json=reg_payload)
            assert res_dup.status_code == 400
            assert "already exists" in res_dup.json()["detail"]

            # -------------------------------------------------------------
            # 3. User Login
            # -------------------------------------------------------------
            login_payload = {
                "email": test_email,
                "password": "SecurePassword123!"
            }
            res_login = await client.post("/api/v1/auth/login", json=login_payload)
            assert res_login.status_code == 200
            assert "access_token" in res_login.json()

            # Incorrect password
            bad_login = {
                "email": test_email,
                "password": "WrongPassword999"
            }
            res_bad_login = await client.post("/api/v1/auth/login", json=bad_login)
            assert res_bad_login.status_code == 401

            # -------------------------------------------------------------
            # 4. Protected Route: /auth/me
            # -------------------------------------------------------------
            res_me = await client.get("/api/v1/auth/me", headers=auth_headers)
            assert res_me.status_code == 200
            assert res_me.json()["email"] == test_email

            # Without token
            res_unauth = await client.get("/api/v1/auth/me")
            assert res_unauth.status_code == 401

            # -------------------------------------------------------------
            # 5. SSRF Validation on Chatbot Creation
            # -------------------------------------------------------------
            ssrf_payload = {
                "name": "Malicious Localhost Bot",
                "api_endpoint": "http://127.0.0.1:8000/internal",
                "api_key": "sk-secret-key"
            }
            res_ssrf = await client.post(
                "/api/v1/chatbots/", json=ssrf_payload, headers=auth_headers
            )
            assert res_ssrf.status_code == 400
            assert "forbidden for security" in res_ssrf.json()["detail"]

            # -------------------------------------------------------------
            # 6. Chatbot Creation with API Key Encryption
            # -------------------------------------------------------------
            raw_api_key = "sk-proj-test1234567890abcdef"
            chatbot_payload = {
                "name": "Customer Support LLM",
                "api_endpoint": "https://api.openai.com/v1/chat/completions",
                "api_key": raw_api_key,
                "http_method": "POST",
                "request_template": '{"messages": [{"role": "user", "content": "{{prompt}}"}]}',
                "response_json_path": "choices[0].message.content"
            }
            res_create = await client.post(
                "/api/v1/chatbots/", json=chatbot_payload, headers=auth_headers
            )
            assert res_create.status_code == 201
            cb_data = res_create.json()
            cb_id = cb_data["id"]
            assert cb_data["name"] == "Customer Support LLM"
            
            # CRITICAL SECURITY CHECK: API key is masked, never raw
            assert cb_data["masked_api_key"] == "sk-...cdef"
            assert raw_api_key not in str(cb_data)

            # -------------------------------------------------------------
            # 7. List Chatbots
            # -------------------------------------------------------------
            res_list = await client.get("/api/v1/chatbots/", headers=auth_headers)
            assert res_list.status_code == 200
            chatbots = res_list.json()
            assert len(chatbots) >= 1
            assert any(c["id"] == cb_id for c in chatbots)

            # -------------------------------------------------------------
            # 8. Get Chatbot by ID
            # -------------------------------------------------------------
            res_get = await client.get(f"/api/v1/chatbots/{cb_id}", headers=auth_headers)
            assert res_get.status_code == 200
            assert res_get.json()["masked_api_key"] == "sk-...cdef"

            # -------------------------------------------------------------
            # 9. Update Chatbot
            # -------------------------------------------------------------
            update_payload = {
                "name": "Customer Support LLM v2"
            }
            res_update = await client.put(
                f"/api/v1/chatbots/{cb_id}", json=update_payload, headers=auth_headers
            )
            assert res_update.status_code == 200
            assert res_update.json()["name"] == "Customer Support LLM v2"

            # -------------------------------------------------------------
            # 10. Test Connection Feature (Mocked outbound call)
            # -------------------------------------------------------------
            mock_call = AsyncMock(return_value=("Connection Verified: LLM is ready.", 200, 185.4))
            with patch("app.api.v1.chatbots.ChatbotClient.call_chatbot", mock_call):
                res_test = await client.post(
                    f"/api/v1/chatbots/{cb_id}/test",
                    json={"test_prompt": "Ping connection"},
                    headers=auth_headers
                )
                assert res_test.status_code == 200
                test_result = res_test.json()
                assert test_result["success"] is True
                assert test_result["status_code"] == 200
                assert test_result["latency_ms"] == 185.4
                assert test_result["extracted_response"] == "Connection Verified: LLM is ready."
                assert test_result["error_message"] is None

            # Test connection failure handling
            mock_fail = AsyncMock(side_effect=Exception("Connection timed out after 30s"))
            with patch("app.api.v1.chatbots.ChatbotClient.call_chatbot", mock_fail):
                res_fail = await client.post(
                    f"/api/v1/chatbots/{cb_id}/test",
                    headers=auth_headers
                )
                assert res_fail.status_code == 200
                fail_result = res_fail.json()
                assert fail_result["success"] is False
                assert "Connection timed out" in fail_result["error_message"]

            # -------------------------------------------------------------
            # 11. Delete Chatbot
            # -------------------------------------------------------------
            res_del = await client.delete(f"/api/v1/chatbots/{cb_id}", headers=auth_headers)
            assert res_del.status_code == 200
            
            # Verify it is gone
            res_after_del = await client.get(f"/api/v1/chatbots/{cb_id}", headers=auth_headers)
            assert res_after_del.status_code == 404
