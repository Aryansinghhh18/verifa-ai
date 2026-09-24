from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BatchRowResult(BaseModel):
    row_index: int
    prompt: str
    response: str
    reference: Optional[str] = None
    hhem_score: Optional[float] = None
    risk_level: str = "unknown"
    status: str = "completed"
    error_message: Optional[str] = None


class BatchSummary(BaseModel):
    total_cases: int
    completed_cases: int
    failed_cases: int
    average_hhem_score: Optional[float] = None
    low_risk_count: int = 0
    medium_risk_count: int = 0
    high_risk_count: int = 0
    processing_time_seconds: float = 0.0


class BatchJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    chatbot_id: Optional[str] = None
    chatbot_name: Optional[str] = None
    file_name: str
    status: str
    total_cases: int
    completed_cases: int
    failed_cases: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    summary: Optional[BatchSummary] = None
    results: List[BatchRowResult] = Field(default_factory=list)


class BatchJobProgress(BaseModel):
    id: str
    status: str
    total_cases: int
    completed_cases: int
    failed_cases: int
    progress_percentage: float = 0.0
