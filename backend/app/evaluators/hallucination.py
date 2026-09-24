import asyncio
import logging
from typing import Optional, List, Tuple
from app.evaluators.base import BaseEvaluator, MetricResult

logger = logging.getLogger("verifa.evaluators.hallucination")


class VectaraHallucinationEvaluator(BaseEvaluator):
    """Factual consistency and hallucination evaluator using Vectara's HHEM.

    Model: vectara/hallucination_evaluation_model
    Architecture: Cross-Encoder Sequence Classifier.
    Premise: Reference / source evidence text.
    Hypothesis: Chatbot-generated response.
    Score: Float in [0.0, 1.0] representing the probability of factual consistency.
    """

    def __init__(self, model_name: str = "vectara/hallucination_evaluation_model", device: str = "auto"):
        self._model_name = model_name
        self._requested_device = device
        self._device = None
        self._model = None
        self._tokenizer = None
        self._is_loaded = False

    @property
    def metric_name(self) -> str:
        return "hallucination"

    @property
    def display_label(self) -> str:
        return "Factual Consistency & Hallucination"

    @property
    def is_implemented(self) -> bool:
        return True

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    def load_model(self) -> None:
        """Loads model weights into memory once.

        Should be called during backend lifespan startup.
        """
        if self._is_loaded:
            return

        import torch
        from transformers import AutoModelForSequenceClassification

        if self._requested_device == "auto":
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self._device = self._requested_device

        logger.info(f"Loading HHEM model '{self._model_name}' on device '{self._device}'...")
        self._model = AutoModelForSequenceClassification.from_pretrained(
            self._model_name,
            trust_remote_code=True
        )
        self._model.to(self._device)
        self._model.eval()
        self._is_loaded = True
        logger.info("HHEM model successfully loaded in memory.")

    def _sync_predict(self, pairs: List[Tuple[str, str]]) -> List[float]:
        """Runs synchronous PyTorch inference on premise-hypothesis pairs using Vectara HHEM predict()."""
        if not self._is_loaded or self._model is None:
            raise RuntimeError("HHEM model is not loaded. Call load_model() first.")

        import torch

        with torch.no_grad():
            scores = self._model.predict(pairs)
            if hasattr(scores, "tolist"):
                return scores.tolist()
            return [float(s) for s in scores]

    async def evaluate(
        self,
        prompt: str,
        chatbot_response: str,
        reference_evidence: Optional[str] = None,
        **kwargs
    ) -> MetricResult:
        """Evaluates factual consistency of the chatbot response against reference evidence (or prompt context)."""
        premise = (reference_evidence.strip() if reference_evidence and reference_evidence.strip() else prompt.strip() if prompt and prompt.strip() else "")
        if not premise:
            return MetricResult(
                metric_type=self.metric_name,
                label=self.display_label,
                status="error",
                raw_score=None,
                normalized_score=None,
                risk_level="unknown",
                error_message="Reference evidence or prompt context is strictly required for factual consistency evaluation with HHEM.",
                details={"model_name": self._model_name}
            )

        if not chatbot_response or not chatbot_response.strip():
            return MetricResult(
                metric_type=self.metric_name,
                label=self.display_label,
                status="error",
                raw_score=None,
                normalized_score=None,
                risk_level="unknown",
                error_message="Chatbot response is empty. Cannot evaluate hallucination.",
                details={"model_name": self._model_name}
            )

        try:
            # Ensure model is ready
            if not self._is_loaded:
                await asyncio.to_thread(self.load_model)

            # Cross-Encoder pair: (premise, hypothesis) = (premise, chatbot_response)
            pairs = [(premise, chatbot_response.strip())]
            
            # Run inference in worker thread to prevent blocking async event loop
            raw_scores = await asyncio.to_thread(self._sync_predict, pairs)
            consistency_score = round(float(raw_scores[0]), 4)

            # Risk classification based on raw consistency score
            # Score near 1.0 means high factual alignment (low risk of hallucination)
            # Score near 0.0 means contradictory or ungrounded (high risk of hallucination)
            if consistency_score >= 0.85:
                risk_level = "low"
            elif consistency_score >= 0.50:
                risk_level = "medium"
            else:
                risk_level = "high"

            return MetricResult(
                metric_type=self.metric_name,
                label=self.display_label,
                status="evaluated",
                raw_score=consistency_score,
                normalized_score=consistency_score,
                risk_level=risk_level,
                details={
                    "model_name": self._model_name,
                    "device": self._device,
                    "consistency_score": consistency_score,
                    "interpretation": (
                        "High factual alignment with reference text." if risk_level == "low"
                        else "Moderate consistency. Potential ambiguity or partial support." if risk_level == "medium"
                        else "High hallucination risk. Output contradicts or lacks reference support."
                    ),
                    "evidence_length": len(reference_evidence.strip()),
                    "response_length": len(chatbot_response.strip())
                }
            )
        except Exception as e:
            logger.error(f"Error executing HHEM evaluation: {str(e)}", exc_info=True)
            return MetricResult(
                metric_type=self.metric_name,
                label=self.display_label,
                status="error",
                raw_score=None,
                normalized_score=None,
                risk_level="unknown",
                error_message=f"Evaluation execution error: {str(e)}",
                details={"model_name": self._model_name}
            )
