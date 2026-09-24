from datetime import datetime
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class ChatbotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    api_endpoint: str = Field(..., min_length=8, max_length=500)
    api_key: Optional[str] = Field(default="", description="External API key, securely encrypted at rest")
    http_method: str = Field(default="POST", pattern="^(POST|GET)$")
    request_template: str = Field(
        default='{"messages": [{"role": "user", "content": "{{prompt}}"}]}',
        description="JSON template containing {{prompt}} placeholder"
    )
    response_json_path: str = Field(
        default="choices[0].message.content",
        description="Path in response JSON, e.g. choices[0].message.content"
    )
    custom_headers: Optional[Dict[str, str]] = Field(default_factory=dict)


class ChatbotUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    api_endpoint: Optional[str] = Field(None, min_length=8, max_length=500)
    api_key: Optional[str] = Field(None, description="Provide new key to replace existing encrypted key")
    http_method: Optional[str] = Field(None, pattern="^(POST|GET)$")
    request_template: Optional[str] = None
    response_json_path: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None


class ChatbotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    api_endpoint: str
    masked_api_key: str = Field(..., description="Masked representation of API key, raw key is never exposed")
    http_method: str
    request_template: str
    response_json_path: str
    created_at: datetime
    updated_at: datetime


class ChatbotTestPingRequest(BaseModel):
    test_prompt: Optional[str] = "Hello, reply with 'Connection Verified' to test endpoint connection."


class ChatbotTestPingResponse(BaseModel):
    success: bool
    status_code: int
    latency_ms: float
    extracted_response: str
    error_message: Optional[str] = None
