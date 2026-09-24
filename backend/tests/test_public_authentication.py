"""Comprehensive test suite for normal public user registration, authentication lifecycle, and data isolation."""
import os
import sys
import uuid
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app, lifespan
from app.core.database import async_session_maker
from app.models.user import User
from sqlalchemy import select


@pytest.mark.asyncio
async def test_public_registration_any_valid_email():
    """Verifies that any standard public or custom email can register, and passwords are hashed."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Test various public email domains
            emails_to_test = [
                f"public.user.{uuid.uuid4().hex[:6]}@gmail.com",
                f"engineer.{uuid.uuid4().hex[:6]}@outlook.com",
                f"researcher.{uuid.uuid4().hex[:6]}@university.edu",
                f"founder.{uuid.uuid4().hex[:6]}@startup.ai",
                f"tester.{uuid.uuid4().hex[:6]}@proton.me",
            ]

            for test_email in emails_to_test:
                plain_password = "SecurePassword123!"
                res = await client.post(
                    "/api/v1/auth/register",
                    json={
                        "full_name": "Public User",
                        "email": test_email,
                        "password": plain_password,
                    },
                )
                assert res.status_code == 201, f"Failed for email {test_email}: {res.text}"
                data = res.json()
                assert "access_token" in data
                assert data["token_type"] == "bearer"
                assert data["user"]["email"] == test_email.lower()
                assert data["user"]["full_name"] == "Public User"

                # Verify password is never stored as plaintext in DB
                async with async_session_maker() as session:
                    stmt = select(User).where(User.email == test_email.lower())
                    user_db = (await session.execute(stmt)).scalar_one()
                    assert user_db.hashed_password != plain_password
                    assert user_db.hashed_password.startswith("$2b$") or user_db.hashed_password.startswith("$2a$")


@pytest.mark.asyncio
async def test_duplicate_email_registration_message():
    """Verifies that registering an existing email returns: 'An account with this email already exists.'"""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            duplicate_email = f"duplicate.{uuid.uuid4().hex[:8]}@example.com"

            # 1. Initial successful registration
            res1 = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Initial User",
                    "email": duplicate_email,
                    "password": "Password123!",
                },
            )
            assert res1.status_code == 201

            # 2. Duplicate registration attempt with same email
            res2 = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Second User",
                    "email": duplicate_email,
                    "password": "DifferentPassword456!",
                },
            )
            assert res2.status_code == 400
            assert res2.json()["detail"] == "An account with this email already exists."

            # 3. Case-insensitive duplicate check
            res3 = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Third User",
                    "email": duplicate_email.upper(),
                    "password": "DifferentPassword456!",
                },
            )
            assert res3.status_code == 400
            assert res3.json()["detail"] == "An account with this email already exists."


@pytest.mark.asyncio
async def test_invalid_password_and_validation():
    """Verifies validation rules: password length and login rejection on invalid credentials."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            test_email = f"val.{uuid.uuid4().hex[:8]}@example.com"

            # Password too short (< 6 chars)
            res_short = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Valid User",
                    "email": test_email,
                    "password": "123",
                },
            )
            assert res_short.status_code == 422

            # Valid registration
            res_valid = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Valid User",
                    "email": test_email,
                    "password": "CorrectPassword123!",
                },
            )
            assert res_valid.status_code == 201

            # Login with incorrect password
            res_wrong = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": test_email,
                    "password": "WrongPassword!",
                },
            )
            assert res_wrong.status_code == 401
            assert res_wrong.json()["detail"] == "Incorrect email or password."


@pytest.mark.asyncio
async def test_login_logout_and_relogin_lifecycle():
    """Verifies full auth lifecycle: register -> login -> authenticate /me -> relogin."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            user_email = f"lifecycle.{uuid.uuid4().hex[:8]}@example.com"
            password = "LifecyclePassword123!"

            # 1. Register
            res_reg = await client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Lifecycle User",
                    "email": user_email,
                    "password": password,
                },
            )
            assert res_reg.status_code == 201
            token_1 = res_reg.json()["access_token"]

            # 2. Access /auth/me with initial token
            res_me_1 = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token_1}"},
            )
            assert res_me_1.status_code == 200
            assert res_me_1.json()["email"] == user_email

            # 3. Simulate client logout and logging in again
            res_login = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": user_email,
                    "password": password,
                },
            )
            assert res_login.status_code == 200
            token_2 = res_login.json()["access_token"]
            assert token_2 is not None

            # 4. Access /auth/me with new token
            res_me_2 = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token_2}"},
            )
            assert res_me_2.status_code == 200
            assert res_me_2.json()["email"] == user_email


@pytest.mark.asyncio
async def test_strict_user_data_isolation():
    """Verifies that User A and User B have completely isolated chatbots, evaluations, history, and analytics."""
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            user_a_email = f"tenant_a_{uuid.uuid4().hex[:8]}@example.com"
            user_b_email = f"tenant_b_{uuid.uuid4().hex[:8]}@example.com"

            # Register User A
            res_a = await client.post("/api/v1/auth/register", json={
                "full_name": "User A",
                "email": user_a_email,
                "password": "PasswordA123!",
            })
            token_a = res_a.json()["access_token"]
            headers_a = {"Authorization": f"Bearer {token_a}"}

            # Register User B
            res_b = await client.post("/api/v1/auth/register", json={
                "full_name": "User B",
                "email": user_b_email,
                "password": "PasswordB123!",
            })
            token_b = res_b.json()["access_token"]
            headers_b = {"Authorization": f"Bearer {token_b}"}

            # User A connects a chatbot
            res_bot_a = await client.post(
                "/api/v1/chatbots/",
                json={
                    "name": "User A Exclusive Bot",
                    "api_endpoint": "https://api.openai.com/v1/chat/completions",
                    "api_key": "sk-secret-key-user-a",
                },
                headers=headers_a,
            )
            assert res_bot_a.status_code == 201
            bot_a_id = res_bot_a.json()["id"]

            # User A uploads a batch evaluation
            csv_content = (
                'prompt,response,reference\n'
                '"Question for User A","User A response text.","User A response text."\n'
            ).encode("utf-8")
            files = {"file": ("data_a.csv", csv_content, "text/csv")}
            res_eval_a = await client.post("/api/v1/batch/upload", files=files, headers=headers_a)
            assert res_eval_a.status_code == 202

            # User B checks their chatbots -> must be empty
            res_bots_b = await client.get("/api/v1/chatbots/", headers=headers_b)
            assert res_bots_b.status_code == 200
            assert len(res_bots_b.json()) == 0

            # User B attempts to access User A's chatbot directly -> must be 404
            res_bot_direct = await client.get(f"/api/v1/chatbots/{bot_a_id}", headers=headers_b)
            assert res_bot_direct.status_code == 404

            # User B checks evaluation history -> must be 0
            res_hist_b = await client.get("/api/v1/evaluations/history", headers=headers_b)
            assert res_hist_b.status_code == 200
            assert res_hist_b.json()["total_count"] == 0
            assert len(res_hist_b.json()["items"]) == 0

            # User B checks analytics -> must be 0 evaluations
            res_analytics_b = await client.get("/api/v1/analytics/overview", headers=headers_b)
            assert res_analytics_b.status_code == 200
            assert res_analytics_b.json()["total_evaluations"] == 0

            # User A sees their own chatbot and evaluation
            res_bots_a = await client.get("/api/v1/chatbots/", headers=headers_a)
            assert len(res_bots_a.json()) == 1

            res_hist_a = await client.get("/api/v1/evaluations/history", headers=headers_a)
            assert res_hist_a.json()["total_count"] == 1
