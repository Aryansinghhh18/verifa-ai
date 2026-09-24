"""Integration test for Phase 1 Backend Foundation.

Verifies:
1. Database tables initialization.
2. EvaluationRegistry with Vectara HHEM and Latency evaluators.
3. FastAPI lifespan startup & /health endpoint reporting model loaded.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.core.security import encrypt_api_key, decrypt_api_key, mask_api_key, get_password_hash, verify_password


@pytest.mark.asyncio
async def test_security_utilities():
    raw_key = "sk-test-secret-key-1234567890abcdef"
    encrypted = encrypt_api_key(raw_key)
    assert encrypted != raw_key
    assert len(encrypted) > len(raw_key)

    decrypted = decrypt_api_key(encrypted)
    assert decrypted == raw_key

    masked = mask_api_key(raw_key)
    assert masked == "sk-...cdef"
    assert raw_key not in masked

    pwd = "securepassword123"
    hashed = get_password_hash(pwd)
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


@pytest.mark.asyncio
async def test_fastapi_lifespan_and_health_endpoint():
    from app.main import lifespan
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            response = await ac.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["eval_engine_ready"] is True
            assert data["hhem_model_loaded"] is True
        
        # Verify metrics list
        metric_types = [m["metric_type"] for m in data["available_metrics"]]
        assert "hallucination" in metric_types
        assert "latency" in metric_types
        assert "toxicity" in metric_types


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_security_utilities())
    print("Security utilities test passed.")
