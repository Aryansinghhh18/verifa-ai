import csv
from datetime import datetime
import io
import json
import logging
import math
from typing import List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.evaluators.registry import EvaluationRegistry
from app.models.chatbot import Chatbot
from app.models.evaluation import Evaluation
from app.models.evaluation_metric import EvaluationMetric
from app.schemas.evaluation import (
    EvaluationDetailResponse,
    EvaluationHistoryItem,
    EvaluationHistoryResponse,
    EvaluationListItem,
    MetricResultItem,
    RunEvaluationRequest,
)
from app.services.chatbot_client import ChatbotClient, ChatbotClientError

logger = logging.getLogger("verifa.services.evaluation_service")


class EvaluationService:
    """Orchestrates chatbot API dispatch, evaluation execution, and DB persistence."""

    def __init__(
        self,
        db: AsyncSession,
        eval_registry: EvaluationRegistry,
        chatbot_client: Optional[ChatbotClient] = None
    ):
        self.db = db
        self.eval_registry = eval_registry
        self.chatbot_client = chatbot_client or ChatbotClient()

    async def run_evaluation(
        self,
        user_id: str,
        request_in: RunEvaluationRequest
    ) -> EvaluationDetailResponse:
        """Executes a full evaluation workflow:

        1. Fetches and validates user's chatbot connection.
        2. Dispatches prompt to the chatbot API endpoint (with timeout and SSRF guard).
        3. Invokes the Evaluation Engine on the response.
        4. Persists the evaluation record and metric results to the database.
        5. Returns the comprehensive evaluation report.
        """
        # Fetch chatbot
        stmt = select(Chatbot).where(
            Chatbot.id == request_in.chatbot_id,
            Chatbot.user_id == user_id
        )
        res = await self.db.execute(stmt)
        chatbot = res.scalar_one_or_none()
        if not chatbot:
            raise ValueError(f"Chatbot connection with ID '{request_in.chatbot_id}' not found.")

        custom_headers = {}
        if chatbot.custom_headers_json:
            try:
                custom_headers = json.loads(chatbot.custom_headers_json)
            except Exception:
                pass

        # Call chatbot endpoint
        chatbot_response_text = ""
        status_code = 0
        latency_ms = 0.0
        eval_status = "success"
        error_message = None

        try:
            chatbot_response_text, status_code, latency_ms = await self.chatbot_client.call_chatbot(
                endpoint_url=chatbot.api_endpoint,
                encrypted_api_key=chatbot.encrypted_api_key,
                prompt=request_in.prompt,
                http_method=chatbot.http_method,
                request_template=chatbot.request_template,
                response_json_path=chatbot.response_json_path,
                custom_headers=custom_headers
            )
        except ChatbotClientError as e:
            logger.warning(f"Chatbot client error during evaluation: {str(e)}")
            eval_status = "error"
            error_message = str(e)
            status_code = getattr(e, "status_code", 502)
        except Exception as e:
            logger.error(f"Unexpected error communicating with chatbot: {str(e)}", exc_info=True)
            eval_status = "error"
            error_message = f"Failed to contact chatbot endpoint: {str(e)}"
            status_code = 500

        # Create evaluation record
        evaluation = Evaluation(
            user_id=user_id,
            chatbot_id=chatbot.id,
            prompt=request_in.prompt,
            reference_evidence=request_in.reference_evidence,
            chatbot_response=chatbot_response_text,
            status_code=status_code,
            response_latency_ms=round(latency_ms, 1),
            status=eval_status,
            error_message=error_message
        )
        self.db.add(evaluation)
        await self.db.flush()

        # If chatbot responded successfully, execute evaluators
        metric_items: List[MetricResultItem] = []
        if eval_status == "success":
            results = await self.eval_registry.evaluate_metrics(
                requested_metrics=request_in.selected_metrics,
                prompt=request_in.prompt,
                chatbot_response=chatbot_response_text,
                reference_evidence=request_in.reference_evidence,
                latency_ms=latency_ms
            )

            for metric_type, result in results.items():
                metric_row = EvaluationMetric(
                    evaluation_id=evaluation.id,
                    metric_type=metric_type,
                    raw_score=result.raw_score,
                    normalized_score=result.normalized_score,
                    risk_level=result.risk_level,
                    status=result.status,
                    label=result.label,
                    details_json=json.dumps(result.details)
                )
                self.db.add(metric_row)

                metric_items.append(
                    MetricResultItem(
                        metric_type=result.metric_type,
                        label=result.label,
                        status=result.status,
                        raw_score=result.raw_score,
                        normalized_score=result.normalized_score,
                        risk_level=result.risk_level,
                        details=result.details,
                        error_message=result.error_message
                    )
                )

        await self.db.commit()
        await self.db.refresh(evaluation)

        return EvaluationDetailResponse(
            id=evaluation.id,
            chatbot_id=chatbot.id,
            chatbot_name=chatbot.name,
            prompt=evaluation.prompt,
            reference_evidence=evaluation.reference_evidence,
            chatbot_response=evaluation.chatbot_response,
            status_code=evaluation.status_code,
            response_latency_ms=evaluation.response_latency_ms,
            status=evaluation.status,
            error_message=evaluation.error_message,
            created_at=evaluation.created_at,
            metrics=metric_items
        )

    async def get_evaluation_detail(
        self,
        user_id: str,
        evaluation_id: str
    ) -> Optional[EvaluationDetailResponse]:
        """Fetches a detailed evaluation record with all metric results."""
        stmt = (
            select(Evaluation)
            .options(
                selectinload(Evaluation.metrics),
                selectinload(Evaluation.chatbot)
            )
            .where(
                Evaluation.id == evaluation_id,
                Evaluation.user_id == user_id
            )
        )
        res = await self.db.execute(stmt)
        evaluation = res.scalar_one_or_none()
        if not evaluation:
            return None

        metric_items = []
        for m in evaluation.metrics:
            details = {}
            if m.details_json:
                try:
                    details = json.loads(m.details_json)
                except Exception:
                    pass
            metric_items.append(
                MetricResultItem(
                    metric_type=m.metric_type,
                    label=m.label,
                    status=m.status,
                    raw_score=m.raw_score,
                    normalized_score=m.normalized_score,
                    risk_level=m.risk_level,
                    details=details
                )
            )

        eval_type = "batch" if evaluation.batch_job_id else "single"
        return EvaluationDetailResponse(
            id=evaluation.id,
            chatbot_id=evaluation.chatbot_id,
            chatbot_name=evaluation.chatbot.name if evaluation.chatbot else ("Batch CSV Job" if evaluation.batch_job_id else "Direct Benchmark"),
            batch_job_id=evaluation.batch_job_id,
            evaluation_type=eval_type,
            prompt=evaluation.prompt,
            reference_evidence=evaluation.reference_evidence,
            chatbot_response=evaluation.chatbot_response,
            status_code=evaluation.status_code,
            response_latency_ms=evaluation.response_latency_ms,
            status=evaluation.status,
            error_message=evaluation.error_message,
            created_at=evaluation.created_at,
            metrics=metric_items
        )

    async def list_evaluations(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[EvaluationListItem]:
        """Lists past evaluations with preview metrics."""
        stmt = (
            select(Evaluation)
            .options(
                selectinload(Evaluation.metrics),
                selectinload(Evaluation.chatbot)
            )
            .where(Evaluation.user_id == user_id)
            .order_by(Evaluation.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        res = await self.db.execute(stmt)
        evaluations = res.scalars().all()

        items = []
        for ev in evaluations:
            # Extract hallucination metric if evaluated
            h_metric = next((m for m in ev.metrics if m.metric_type == "hallucination"), None)
            h_score = h_metric.raw_score if h_metric else None
            h_risk = h_metric.risk_level if h_metric else "unknown"

            prompt_prev = ev.prompt[:80] + ("..." if len(ev.prompt) > 80 else "")
            bot_name = ev.chatbot.name if ev.chatbot else ("Batch CSV Job" if ev.batch_job_id else "Direct Benchmark")
            eval_type = "batch" if ev.batch_job_id else "single"

            items.append(
                EvaluationListItem(
                    id=ev.id,
                    chatbot_id=ev.chatbot_id,
                    chatbot_name=bot_name,
                    batch_job_id=ev.batch_job_id,
                    evaluation_type=eval_type,
                    prompt_preview=prompt_prev,
                    hallucination_score=h_score,
                    risk_level=h_risk,
                    response_latency_ms=ev.response_latency_ms,
                    status=ev.status,
                    created_at=ev.created_at
                )
            )

        return items

    async def list_history(
        self,
        user_id: str,
        search: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        evaluation_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: str = "date_desc",
        page: int = 1,
        page_size: int = 20,
    ) -> EvaluationHistoryResponse:
        """Filters, sorts, and paginates evaluation history records strictly for the current user."""
        conditions = [Evaluation.user_id == user_id]

        if chatbot_id and chatbot_id.strip():
            conditions.append(Evaluation.chatbot_id == chatbot_id.strip())

        if evaluation_type == "single":
            conditions.append(Evaluation.batch_job_id.is_(None))
        elif evaluation_type == "batch":
            conditions.append(Evaluation.batch_job_id.is_not(None))

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Evaluation.prompt.ilike(term),
                    Evaluation.chatbot_response.ilike(term),
                )
            )

        if start_date:
            conditions.append(Evaluation.created_at >= start_date)
        if end_date:
            conditions.append(Evaluation.created_at <= end_date)

        # Count total matches
        count_stmt = select(func.count(Evaluation.id)).where(*conditions)
        total_count = (await self.db.execute(count_stmt)).scalar() or 0

        # Query items
        stmt = (
            select(Evaluation)
            .options(
                selectinload(Evaluation.metrics),
                selectinload(Evaluation.chatbot)
            )
            .where(*conditions)
        )

        if sort_by == "date_asc":
            stmt = stmt.order_by(Evaluation.created_at.asc())
        elif sort_by == "latency_desc":
            stmt = stmt.order_by(Evaluation.response_latency_ms.desc())
        elif sort_by == "latency_asc":
            stmt = stmt.order_by(Evaluation.response_latency_ms.asc())
        else:
            stmt = stmt.order_by(Evaluation.created_at.desc())

        if sort_by not in ("score_desc", "score_asc"):
            offset = max(0, (page - 1) * page_size)
            stmt = stmt.limit(page_size).offset(offset)

        res = await self.db.execute(stmt)
        records = list(res.scalars().all())

        items: List[EvaluationHistoryItem] = []
        for ev in records:
            h_metric = next((m for m in ev.metrics if m.metric_type == "hallucination"), None)
            h_score = h_metric.raw_score if h_metric else None
            h_risk = h_metric.risk_level if h_metric else "unknown"
            bot_name = ev.chatbot.name if ev.chatbot else ("Batch CSV Job" if ev.batch_job_id else "Direct Benchmark")
            eval_type = "batch" if ev.batch_job_id else "single"

            items.append(
                EvaluationHistoryItem(
                    id=ev.id,
                    chatbot_id=ev.chatbot_id,
                    chatbot_name=bot_name,
                    batch_job_id=ev.batch_job_id,
                    evaluation_type=eval_type,
                    prompt=ev.prompt,
                    chatbot_response=ev.chatbot_response,
                    reference_evidence=ev.reference_evidence,
                    hallucination_score=h_score,
                    risk_level=h_risk,
                    response_latency_ms=ev.response_latency_ms,
                    status=ev.status,
                    created_at=ev.created_at
                )
            )

        if sort_by == "score_desc":
            items.sort(key=lambda x: (x.hallucination_score if x.hallucination_score is not None else -1.0), reverse=True)
            offset = max(0, (page - 1) * page_size)
            items = items[offset:offset + page_size]
        elif sort_by == "score_asc":
            items.sort(key=lambda x: (x.hallucination_score if x.hallucination_score is not None else 999.0))
            offset = max(0, (page - 1) * page_size)
            items = items[offset:offset + page_size]

        total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1

        return EvaluationHistoryResponse(
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=items
        )

    async def export_history_csv(
        self,
        user_id: str,
        chatbot_id: Optional[str] = None,
        evaluation_type: Optional[str] = None,
    ) -> str:
        """Generates a downloadable CSV containing all evaluations for the authenticated user."""
        conditions = [Evaluation.user_id == user_id]
        if chatbot_id and chatbot_id.strip():
            conditions.append(Evaluation.chatbot_id == chatbot_id.strip())
        if evaluation_type == "single":
            conditions.append(Evaluation.batch_job_id.is_(None))
        elif evaluation_type == "batch":
            conditions.append(Evaluation.batch_job_id.is_not(None))

        stmt = (
            select(Evaluation)
            .options(
                selectinload(Evaluation.metrics),
                selectinload(Evaluation.chatbot)
            )
            .where(*conditions)
            .order_by(Evaluation.created_at.desc())
        )
        res = await self.db.execute(stmt)
        records = res.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            "Evaluation ID",
            "Date (UTC)",
            "Chatbot Name",
            "Evaluation Type",
            "Prompt",
            "Chatbot Response",
            "Reference / Evidence",
            "Vectara HHEM Consistency Score",
            "Hallucination Risk Level",
            "Latency (ms)",
            "Status",
            "Error Message",
        ])

        for ev in records:
            h_metric = next((m for m in ev.metrics if m.metric_type == "hallucination"), None)
            h_score = f"{h_metric.raw_score:.4f}" if (h_metric and h_metric.raw_score is not None) else "N/A"
            h_risk = h_metric.risk_level if h_metric else "unknown"
            bot_name = ev.chatbot.name if ev.chatbot else ("Batch CSV Job" if ev.batch_job_id else "Direct Benchmark")
            eval_type = "batch" if ev.batch_job_id else "single"

            writer.writerow([
                ev.id,
                ev.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                bot_name,
                eval_type,
                ev.prompt,
                ev.chatbot_response,
                ev.reference_evidence or "",
                h_score,
                h_risk,
                f"{ev.response_latency_ms:.1f}",
                ev.status,
                ev.error_message or "",
            ])

        return output.getvalue()
