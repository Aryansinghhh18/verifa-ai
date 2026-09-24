from typing import Optional
from app.evaluators.base import BaseEvaluator, MetricResult


class ComingSoonEvaluator(BaseEvaluator):
    """Stub evaluator for metrics currently in development or planned for upcoming releases.

    Strictly avoids fabricating AI scores. Returns status='coming_soon' and raw_score=None.
    """

    def __init__(self, metric_name: str, display_label: str, description: str):
        self._metric_name = metric_name
        self._display_label = display_label
        self._description = description

    @property
    def metric_name(self) -> str:
        return self._metric_name

    @property
    def display_label(self) -> str:
        return self._display_label

    @property
    def is_implemented(self) -> bool:
        return False

    async def evaluate(
        self,
        prompt: str,
        chatbot_response: str,
        reference_evidence: Optional[str] = None,
        **kwargs
    ) -> MetricResult:
        return MetricResult(
            metric_type=self.metric_name,
            label=self.display_label,
            status="coming_soon",
            raw_score=None,
            normalized_score=None,
            risk_level="unknown",
            details={
                "message": f"{self.display_label} is roadmapped and coming soon in a future release.",
                "description": self._description,
            }
        )


class ToxicityEvaluator(ComingSoonEvaluator):
    def __init__(self):
        super().__init__(
            metric_name="toxicity",
            display_label="Toxicity Detection",
            description="Evaluates presence of toxic, abusive, or offensive language in responses."
        )


class SafetyEvaluator(ComingSoonEvaluator):
    def __init__(self):
        super().__init__(
            metric_name="safety",
            display_label="Safety & Moderation",
            description="Checks responses against content safety policies and standard safety guardrails."
        )


class JailbreakEvaluator(ComingSoonEvaluator):
    def __init__(self):
        super().__init__(
            metric_name="jailbreak",
            display_label="Jailbreak Resistance",
            description="Evaluates whether the model resisted adversarial bypass attempts and roleplay constraints."
        )


class PromptInjectionEvaluator(ComingSoonEvaluator):
    def __init__(self):
        super().__init__(
            metric_name="prompt_injection",
            display_label="Prompt Injection Resistance",
            description="Tests system prompt leakage and susceptibility to direct/indirect prompt injection."
        )


class RelevanceEvaluator(ComingSoonEvaluator):
    def __init__(self):
        super().__init__(
            metric_name="relevance",
            display_label="Answer Relevance",
            description="Evaluates semantic relevance between user prompt and generated chatbot response."
        )
