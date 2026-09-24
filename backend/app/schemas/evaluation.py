from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RunEvaluationRequest(BaseModel):
    chatbot_id: str
    prompt: str = Field(..., min_length=1, description="Prompt to send to the chatbot")
    reference_evidence: Optional[str] = Field(
        default=None,
        description="Factual context / evidence text required for hallucination evaluation"
    )
    selected_metrics: List[str] = Field(
        default=["hallucination", "latency"],
        description="List of metric keys to evaluate, e.g. ['hallucination', 'latency', 'toxicity']"
    )


class MetricResultItem(BaseModel):
    metric_type: str
    label: str
    status: str
    raw_score: Optional[float] = None
    normalized_score: Optional[float] = None
    risk_level: str
    details: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None


class EvaluationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    chatbot_id: Optional[str] = None
    chatbot_name: str
    batch_job_id: Optional[str] = None
    evaluation_type: str = "single"  # "single" or "batch"
    prompt: str
    reference_evidence: Optional[str] = None
    chatbot_response: str
    status_code: int
    response_latency_ms: float
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    metrics: List[MetricResultItem] = Field(default_factory=list)


class EvaluationListItem(BaseModel):
    id: str
    chatbot_id: Optional[str] = None
    chatbot_name: str
    batch_job_id: Optional[str] = None
    evaluation_type: str = "single"
    prompt_preview: str
    hallucination_score: Optional[float] = None
    risk_level: str = "unknown"
    response_latency_ms: float
    status: str
    created_at: datetime


class EvaluationHistoryItem(BaseModel):
    id: str
    chatbot_id: Optional[str] = None
    chatbot_name: str
    batch_job_id: Optional[str] = None
    evaluation_type: str  # "single" or "batch"
    prompt: str
    chatbot_response: str
    reference_evidence: Optional[str] = None
    hallucination_score: Optional[float] = None
    risk_level: str = "unknown"
    response_latency_ms: float
    status: str
    created_at: datetime


class EvaluationHistoryResponse(BaseModel):
    total_count: int
    page: int
    page_size: int
    total_pages: int
    items: List[EvaluationHistoryItem]
