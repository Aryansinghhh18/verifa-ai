import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import decrypt_api_key, encrypt_api_key, mask_api_key
from app.models.chatbot import Chatbot
from app.models.user import User
from app.schemas.chatbot import (
    ChatbotCreate,
    ChatbotResponse,
    ChatbotTestPingRequest,
    ChatbotTestPingResponse,
    ChatbotUpdate,
)
from app.services.chatbot_client import (
    ChatbotClient,
    ChatbotClientError,
    ChatbotSSRFError,
    validate_endpoint_url,
)

logger = logging.getLogger("verifa.api.chatbots")
router = APIRouter()


def _to_response_schema(chatbot: Chatbot) -> ChatbotResponse:
    """Safely builds ChatbotResponse with masked API key."""
    try:
        plain_key = decrypt_api_key(chatbot.encrypted_api_key) if chatbot.encrypted_api_key else ""
        masked = mask_api_key(plain_key)
    except Exception:
        masked = "********"

    return ChatbotResponse(
        id=chatbot.id,
        name=chatbot.name,
        api_endpoint=chatbot.api_endpoint,
        masked_api_key=masked,
        http_method=chatbot.http_method,
        request_template=chatbot.request_template,
        response_json_path=chatbot.response_json_path,
        created_at=chatbot.created_at,
        updated_at=chatbot.updated_at,
    )


@router.get("/", response_model=List[ChatbotResponse])
async def list_chatbots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all registered chatbots belonging to the authenticated user."""
    stmt = (
        select(Chatbot)
        .where(Chatbot.user_id == current_user.id)
        .order_by(Chatbot.created_at.desc())
    )
    result = await db.execute(stmt)
    chatbots = result.scalars().all()
    return [_to_response_schema(cb) for cb in chatbots]


@router.post("/", response_model=ChatbotResponse, status_code=status.HTTP_201_CREATED)
async def create_chatbot(
    chatbot_in: ChatbotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Registers a new external chatbot API endpoint."""
    # SSRF & URL validation
    try:
        validate_endpoint_url(chatbot_in.api_endpoint)
    except ChatbotSSRFError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Securely encrypt API key at rest
    encrypted_key = encrypt_api_key(chatbot_in.api_key) if chatbot_in.api_key else ""

    headers_json = json.dumps(chatbot_in.custom_headers or {})

    chatbot = Chatbot(
        user_id=current_user.id,
        name=chatbot_in.name.strip(),
        api_endpoint=chatbot_in.api_endpoint.strip(),
        encrypted_api_key=encrypted_key,
        http_method=chatbot_in.http_method.upper(),
        request_template=chatbot_in.request_template,
        response_json_path=chatbot_in.response_json_path.strip(),
        custom_headers_json=headers_json,
    )
    db.add(chatbot)
    await db.commit()
    await db.refresh(chatbot)

    logger.info(f"Registered chatbot '{chatbot.name}' (ID: {chatbot.id}) for user {current_user.id}")
    return _to_response_schema(chatbot)


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
async def get_chatbot(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves details of a specific chatbot connection."""
    stmt = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chatbot = result.scalar_one_or_none()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot connection not found.",
        )

    return _to_response_schema(chatbot)


@router.put("/{chatbot_id}", response_model=ChatbotResponse)
async def update_chatbot(
    chatbot_id: str,
    update_in: ChatbotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates an existing chatbot connection."""
    stmt = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chatbot = result.scalar_one_or_none()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot connection not found.",
        )

    if update_in.api_endpoint is not None:
        try:
            validate_endpoint_url(update_in.api_endpoint)
        except ChatbotSSRFError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        chatbot.api_endpoint = update_in.api_endpoint.strip()

    if update_in.name is not None:
        chatbot.name = update_in.name.strip()

    if update_in.api_key is not None:
        chatbot.encrypted_api_key = encrypt_api_key(update_in.api_key)

    if update_in.http_method is not None:
        chatbot.http_method = update_in.http_method.upper()

    if update_in.request_template is not None:
        chatbot.request_template = update_in.request_template

    if update_in.response_json_path is not None:
        chatbot.response_json_path = update_in.response_json_path.strip()

    if update_in.custom_headers is not None:
        chatbot.custom_headers_json = json.dumps(update_in.custom_headers)

    await db.commit()
    await db.refresh(chatbot)
    return _to_response_schema(chatbot)


@router.delete("/{chatbot_id}", status_code=status.HTTP_200_OK)
async def delete_chatbot(
    chatbot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a chatbot connection."""
    stmt = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chatbot = result.scalar_one_or_none()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot connection not found.",
        )

    await db.delete(chatbot)
    await db.commit()
    return {"message": "Chatbot connection deleted successfully.", "id": chatbot_id}


@router.post("/{chatbot_id}/test", response_model=ChatbotTestPingResponse)
async def test_chatbot_connection(
    chatbot_id: str,
    test_req: Optional[ChatbotTestPingRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tests connectivity to user's external chatbot API without executing evaluations."""
    stmt = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chatbot = result.scalar_one_or_none()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot connection not found.",
        )

    prompt = (
        test_req.test_prompt
        if test_req and test_req.test_prompt
        else "Hello, reply with 'Connection Verified' to test endpoint connection."
    )

    client = ChatbotClient()
    custom_headers = {}
    if chatbot.custom_headers_json:
        try:
            custom_headers = json.loads(chatbot.custom_headers_json)
        except Exception:
            pass

    try:
        extracted_text, status_code, latency_ms = await client.call_chatbot(
            endpoint_url=chatbot.api_endpoint,
            encrypted_api_key=chatbot.encrypted_api_key,
            prompt=prompt,
            http_method=chatbot.http_method,
            request_template=chatbot.request_template,
            response_json_path=chatbot.response_json_path,
            custom_headers=custom_headers,
        )
        return ChatbotTestPingResponse(
            success=True,
            status_code=status_code,
            latency_ms=round(latency_ms, 1),
            extracted_response=extracted_text,
            error_message=None,
        )
    except ChatbotClientError as e:
        return ChatbotTestPingResponse(
            success=False,
            status_code=0,
            latency_ms=0.0,
            extracted_response="",
            error_message=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected error in test_chatbot_connection: {str(e)}", exc_info=True)
        return ChatbotTestPingResponse(
            success=False,
            status_code=0,
            latency_ms=0.0,
            extracted_response="",
            error_message=f"Failed to test connection: {str(e)}",
        )
