"""Hallucination evaluator service module.

Exposes the isolated Vectara HHEM service for factual consistency and hallucination evaluation.
"""
from app.evaluators.hallucination import VectaraHallucinationEvaluator

# Alias for service consumers
HallucinationEvaluator = VectaraHallucinationEvaluator

__all__ = ["HallucinationEvaluator", "VectaraHallucinationEvaluator"]
