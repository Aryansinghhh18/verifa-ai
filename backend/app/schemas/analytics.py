from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class RiskBreakdown(BaseModel):
    low: int = 0
    medium: int = 0
    high: int = 0


class TimeSeriesPoint(BaseModel):
    date: str
    count: int = 0
    avg_hhem_score: Optional[float] = None
    avg_latency_ms: Optional[float] = None
    low_risk_count: int = 0
    med_risk_count: int = 0
    high_risk_count: int = 0


class ChatbotDistributionPoint(BaseModel):
    chatbot_id: Optional[str] = None
    name: str
    count: int = 0
    avg_hhem_score: Optional[float] = None
    avg_latency_ms: Optional[float] = None


class AnalyticsOverviewResponse(BaseModel):
    total_evaluations: int
    average_hhem_score: Optional[float] = None
    average_latency_ms: Optional[float] = None
    failed_evaluations: int
    evaluated_chatbots_count: int
    risk_breakdown: RiskBreakdown
    time_filter: str
    evaluations_over_time: List[TimeSeriesPoint] = Field(default_factory=list)
    consistency_trend: List[TimeSeriesPoint] = Field(default_factory=list)
    latency_trend: List[TimeSeriesPoint] = Field(default_factory=list)
    chatbot_distribution: List[ChatbotDistributionPoint] = Field(default_factory=list)
