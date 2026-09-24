from typing import Optional
from app.evaluators.base import BaseEvaluator, MetricResult


class LatencyEvaluator(BaseEvaluator):
    """Evaluates chatbot response latency, throughput, and performance."""

    @property
    def metric_name(self) -> str:
        return "latency"

    @property
    def display_label(self) -> str:
        return "Latency & Performance"

    @property
    def is_implemented(self) -> bool:
        return True

    async def evaluate(
        self,
        prompt: str,
        chatbot_response: str,
        reference_evidence: Optional[str] = None,
        latency_ms: float = 0.0,
        **kwargs
    ) -> MetricResult:
        # Latency rating:
        # < 1000ms: low latency (excellent)
        # 1000ms - 3000ms: medium latency (acceptable)
        # > 3000ms: high latency (slow)
        if latency_ms < 1000:
            risk_level = "low"
        elif latency_ms < 3000:
            risk_level = "medium"
        else:
            risk_level = "high"

        char_count = len(chatbot_response)
        word_count = len(chatbot_response.split())
        chars_per_sec = round((char_count / (latency_ms / 1000.0)), 1) if latency_ms > 0 else 0.0

        return MetricResult(
            metric_type=self.metric_name,
            label=self.display_label,
            status="evaluated",
            raw_score=round(latency_ms, 1),
            normalized_score=round(max(0.0, min(1.0, 1.0 - (latency_ms / 5000.0))), 3),
            risk_level=risk_level,
            details={
                "latency_ms": round(latency_ms, 1),
                "latency_seconds": round(latency_ms / 1000.0, 2),
                "char_count": char_count,
                "word_count": word_count,
                "chars_per_second": chars_per_sec
            }
        )
