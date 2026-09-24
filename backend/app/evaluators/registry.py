import asyncio
import logging
from typing import Dict, List, Optional
from app.evaluators.base import BaseEvaluator, MetricResult
from app.evaluators.hallucination import VectaraHallucinationEvaluator
from app.evaluators.latency import LatencyEvaluator
from app.evaluators.stubs import (
    ToxicityEvaluator,
    SafetyEvaluator,
    JailbreakEvaluator,
    PromptInjectionEvaluator,
    RelevanceEvaluator,
)

logger = logging.getLogger("verifa.evaluators.registry")


class EvaluationRegistry:
    """Central registry and executor for all evaluation metrics.

    Completely isolated from the FastAPI routing/transport layer.
    """

    def __init__(self, hallucination_evaluator: Optional[VectaraHallucinationEvaluator] = None):
        self._evaluators: Dict[str, BaseEvaluator] = {}

        # Register active evaluators
        hhem = hallucination_evaluator or VectaraHallucinationEvaluator()
        self.register(hhem)
        self.register(LatencyEvaluator())

        # Register roadmapped stub evaluators
        self.register(ToxicityEvaluator())
        self.register(SafetyEvaluator())
        self.register(JailbreakEvaluator())
        self.register(PromptInjectionEvaluator())
        self.register(RelevanceEvaluator())

    def register(self, evaluator: BaseEvaluator) -> None:
        """Registers an evaluator."""
        self._evaluators[evaluator.metric_name] = evaluator
        logger.debug(f"Registered evaluator: {evaluator.metric_name} (implemented={evaluator.is_implemented})")

    def get(self, metric_name: str) -> Optional[BaseEvaluator]:
        """Retrieves an evaluator by its identifier."""
        return self._evaluators.get(metric_name)

    def list_metrics(self) -> List[Dict[str, any]]:
        """Returns metadata for all available and roadmapped metrics."""
        metrics_info = []
        for name, evaluator in self._evaluators.items():
            metrics_info.append({
                "metric_type": name,
                "label": evaluator.display_label,
                "is_implemented": evaluator.is_implemented,
                "status": "active" if evaluator.is_implemented else "coming_soon"
            })
        return metrics_info

    async def evaluate_metrics(
        self,
        requested_metrics: List[str],
        prompt: str,
        chatbot_response: str,
        reference_evidence: Optional[str] = None,
        latency_ms: float = 0.0,
        **kwargs
    ) -> Dict[str, MetricResult]:
        """Concurrently runs all requested evaluation metrics."""
        results: Dict[str, MetricResult] = {}
        tasks = []
        task_metric_names = []

        # Always include latency if not explicitly requested, or if requested
        metrics_to_run = list(dict.fromkeys(requested_metrics))
        if "latency" not in metrics_to_run:
            metrics_to_run.append("latency")

        for metric_name in metrics_to_run:
            evaluator = self._evaluators.get(metric_name)
            if not evaluator:
                results[metric_name] = MetricResult(
                    metric_type=metric_name,
                    label=metric_name.replace("_", " ").title(),
                    status="error",
                    error_message=f"Unknown metric '{metric_name}'"
                )
                continue

            tasks.append(
                evaluator.evaluate(
                    prompt=prompt,
                    chatbot_response=chatbot_response,
                    reference_evidence=reference_evidence,
                    latency_ms=latency_ms,
                    **kwargs
                )
            )
            task_metric_names.append(metric_name)

        if tasks:
            evaluated_results = await asyncio.gather(*tasks, return_exceptions=True)
            for metric_name, res in zip(task_metric_names, evaluated_results):
                if isinstance(res, Exception):
                    logger.error(f"Error in evaluator '{metric_name}': {str(res)}")
                    results[metric_name] = MetricResult(
                        metric_type=metric_name,
                        label=metric_name.replace("_", " ").title(),
                        status="error",
                        error_message=str(res)
                    )
                else:
                    results[metric_name] = res

        return results
