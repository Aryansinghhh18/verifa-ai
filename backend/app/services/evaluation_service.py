import csv
from datetime import datetime
import io
import json
import logging
import math
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, or_, delete
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
            from app.models.testlab_run import TestLabRun
            tl_stmt = select(TestLabRun).where(
                TestLabRun.id == evaluation_id,
                TestLabRun.user_id == user_id
            )
            tl_res = await self.db.execute(tl_stmt)
            tl_run = tl_res.scalar_one_or_none()
            if not tl_run:
                return None

            summary_metrics = {}
            if tl_run.summary_metrics_json:
                try:
                    summary_metrics = json.loads(tl_run.summary_metrics_json)
                except Exception:
                    pass

            metric_items = []
            hl_rate = summary_metrics.get("potential_hallucination_rate")
            if hl_rate is not None:
                c_score = round(max(0.0, 1.0 - (float(hl_rate) / 100.0)), 4)
                metric_items.append(
                    MetricResultItem(
                        metric_type="hallucination",
                        label="Factual Consistency & Hallucination",
                        status="evaluated",
                        raw_score=c_score,
                        normalized_score=c_score,
                        risk_level="high" if float(hl_rate) > 30 else ("medium" if float(hl_rate) > 10 else "low"),
                        details={"potential_hallucination_rate": hl_rate}
                    )
                )

            tox_rate = summary_metrics.get("toxicity_rate")
            if tox_rate is not None:
                t_score = round(float(tox_rate) / 100.0, 4)
                metric_items.append(
                    MetricResultItem(
                        metric_type="toxicity",
                        label="Toxicity & Content Safety",
                        status="evaluated",
                        raw_score=t_score,
                        normalized_score=t_score,
                        risk_level="high" if float(tox_rate) > 20 else ("medium" if float(tox_rate) > 5 else "low"),
                        details={"toxicity_rate": tox_rate}
                    )
                )

            return EvaluationDetailResponse(
                id=tl_run.id,
                chatbot_id=tl_run.chatbot_id,
                chatbot_name=tl_run.chatbot_name,
                batch_job_id=None,
                evaluation_type="testlab",
                prompt=f"TestLab Benchmark Suite: {tl_run.test_suite.upper()} ({tl_run.completed_tests}/{tl_run.total_tests} tests)",
                reference_evidence=f"Benchmark Suite: {tl_run.test_suite.upper()}",
                chatbot_response=f"Status: {tl_run.status} | Passed: {tl_run.passed_tests} | Potential Issues: {tl_run.potential_issue_tests} | Errors: {tl_run.failed_tests}",
                status_code=200 if tl_run.status == "Completed" else 500,
                response_latency_ms=(tl_run.duration_seconds or 0.0) * 1000.0,
                status="success" if tl_run.status == "Completed" else "error",
                error_message=None if tl_run.status == "Completed" else f"Run ended with status: {tl_run.status}",
                created_at=tl_run.created_at,
                metrics=metric_items
            )

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
        """Filters, sorts, and paginates evaluation history records strictly for the current user.

        Supports Single Prompt ('single'), Batch CSV ('batch'), TestLab Benchmark ('testlab'), or All ('all' / None).
        """
        eval_items: List[EvaluationHistoryItem] = []
        clean_type = (evaluation_type or "all").lower().strip()

        # 1. Fetch from evaluations table (if single, batch, or all)
        if clean_type in ("all", "single", "batch"):
            conditions = [Evaluation.user_id == user_id]

            if chatbot_id and chatbot_id.strip():
                conditions.append(Evaluation.chatbot_id == chatbot_id.strip())

            if clean_type == "single":
                conditions.append(Evaluation.batch_job_id.is_(None))
            elif clean_type == "batch":
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

            stmt = (
                select(Evaluation)
                .options(
                    selectinload(Evaluation.metrics),
                    selectinload(Evaluation.chatbot)
                )
                .where(*conditions)
            )

            res = await self.db.execute(stmt)
            records = list(res.scalars().all())

            for ev in records:
                h_metric = next((m for m in ev.metrics if m.metric_type == "hallucination"), None)
                h_score = h_metric.raw_score if h_metric else None
                h_risk = h_metric.risk_level if h_metric else "unknown"
                bot_name = ev.chatbot.name if ev.chatbot else ("Batch CSV Job" if ev.batch_job_id else "Direct Benchmark")
                ev_type = "batch" if ev.batch_job_id else "single"

                eval_items.append(
                    EvaluationHistoryItem(
                        id=ev.id,
                        chatbot_id=ev.chatbot_id,
                        chatbot_name=bot_name,
                        batch_job_id=ev.batch_job_id,
                        evaluation_type=ev_type,
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

        # 2. Fetch from testlab_runs table (if testlab or all)
        tl_items: List[EvaluationHistoryItem] = []
        if clean_type in ("all", "testlab"):
            from app.models.testlab_run import TestLabRun
            tl_conditions = [TestLabRun.user_id == user_id]

            if chatbot_id and chatbot_id.strip():
                tl_conditions.append(TestLabRun.chatbot_id == chatbot_id.strip())

            if search and search.strip():
                term = f"%{search.strip()}%"
                tl_conditions.append(
                    or_(
                        TestLabRun.chatbot_name.ilike(term),
                        TestLabRun.test_suite.ilike(term),
                    )
                )

            if start_date:
                tl_conditions.append(TestLabRun.created_at >= start_date)
            if end_date:
                tl_conditions.append(TestLabRun.created_at <= end_date)

            tl_stmt = select(TestLabRun).where(*tl_conditions)
            tl_res = await self.db.execute(tl_stmt)
            tl_runs = list(tl_res.scalars().all())

            for tl in tl_runs:
                hl_score = None
                if tl.summary_metrics_json:
                    try:
                        sm = json.loads(tl.summary_metrics_json)
                        if "potential_hallucination_rate" in sm and sm["potential_hallucination_rate"] is not None:
                            hl_score = round(max(0.0, 1.0 - (float(sm["potential_hallucination_rate"]) / 100.0)), 4)
                    except Exception:
                        pass

                risk = "high" if (tl.potential_issue_tests > 0 or tl.failed_tests > 0) else "low"
                status_str = "success" if tl.status == "Completed" else "error"
                duration_ms = (tl.duration_seconds or 0.0) * 1000.0

                tl_items.append(
                    EvaluationHistoryItem(
                        id=tl.id,
                        chatbot_id=tl.chatbot_id,
                        chatbot_name=tl.chatbot_name,
                        batch_job_id=None,
                        evaluation_type="testlab",
                        prompt=f"TestLab Suite: {tl.test_suite.upper()} ({tl.completed_tests}/{tl.total_tests} tests)",
                        chatbot_response=f"Status: {tl.status} | Passed: {tl.passed_tests} | Potential Issues: {tl.potential_issue_tests} | Errors: {tl.failed_tests}",
                        reference_evidence=f"Duration: {tl.duration_seconds}s",
                        hallucination_score=hl_score,
                        risk_level=risk,
                        response_latency_ms=duration_ms,
                        status=status_str,
                        created_at=tl.created_at
                    )
                )

        all_items = eval_items + tl_items

        # Sorting
        if sort_by == "date_asc":
            all_items.sort(key=lambda x: x.created_at)
        elif sort_by == "latency_desc":
            all_items.sort(key=lambda x: x.response_latency_ms, reverse=True)
        elif sort_by == "latency_asc":
            all_items.sort(key=lambda x: x.response_latency_ms)
        elif sort_by == "score_desc":
            all_items.sort(key=lambda x: (x.hallucination_score if x.hallucination_score is not None else -1.0), reverse=True)
        elif sort_by == "score_asc":
            all_items.sort(key=lambda x: (x.hallucination_score if x.hallucination_score is not None else 999.0))
        else:
            all_items.sort(key=lambda x: x.created_at, reverse=True)

        total_count = len(all_items)
        total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
        offset = max(0, (page - 1) * page_size)
        paginated_items = all_items[offset:offset + page_size]

        return EvaluationHistoryResponse(
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=paginated_items
        )

    async def export_history_csv(
        self,
        user_id: str,
        chatbot_id: Optional[str] = None,
        evaluation_type: Optional[str] = None,
    ) -> str:
        """Generates a downloadable CSV containing all evaluations for the authenticated user."""
        res = await self.list_history(
            user_id=user_id,
            chatbot_id=chatbot_id,
            evaluation_type=evaluation_type,
            page=1,
            page_size=10000,
            sort_by="date_desc"
        )
        records = res.items

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
        ])

        for ev in records:
            h_score = f"{ev.hallucination_score:.4f}" if ev.hallucination_score is not None else "N/A"
            writer.writerow([
                ev.id,
                ev.created_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(ev.created_at, "strftime") else str(ev.created_at),
                ev.chatbot_name,
                ev.evaluation_type,
                ev.prompt,
                ev.chatbot_response,
                ev.reference_evidence or "",
                h_score,
                ev.risk_level,
                f"{ev.response_latency_ms:.1f}",
                ev.status,
            ])

        return output.getvalue()

    async def delete_evaluation(self, user_id: str, evaluation_id: str) -> bool:
        """Deletes a single evaluation record after strictly verifying user ownership.

        Supports Single Prompt, Batch, and TestLab evaluations.
        Raises:
            HTTPException 403 if record exists but belongs to another user.
            HTTPException 404 if record does not exist.
        """
        from app.models.testlab_run import TestLabRun
        from app.models.batch_job import BatchJob

        # 1. Check in evaluations table
        stmt = select(Evaluation).where(Evaluation.id == evaluation_id)
        res = await self.db.execute(stmt)
        evaluation = res.scalar_one_or_none()

        if evaluation:
            if evaluation.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to delete this evaluation."
                )

            batch_job_id = evaluation.batch_job_id
            await self.db.delete(evaluation)
            await self.db.flush()

            # If part of a batch job, check if any evaluations remain for that batch job
            if batch_job_id:
                chk_stmt = select(func.count(Evaluation.id)).where(Evaluation.batch_job_id == batch_job_id)
                remaining = (await self.db.execute(chk_stmt)).scalar() or 0
                if remaining == 0:
                    bj_res = await self.db.execute(select(BatchJob).where(BatchJob.id == batch_job_id))
                    bj = bj_res.scalar_one_or_none()
                    if bj:
                        await self.db.delete(bj)

            await self.db.commit()
            return True

        # 2. Check in testlab_runs table
        tl_stmt = select(TestLabRun).where(TestLabRun.id == evaluation_id)
        tl_res = await self.db.execute(tl_stmt)
        tl_run = tl_res.scalar_one_or_none()

        if tl_run:
            if tl_run.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to delete this evaluation."
                )
            await self.db.delete(tl_run)
            await self.db.commit()
            return True

        # 3. Check in batch_jobs table (if a batch job ID was passed)
        bj_stmt = select(BatchJob).where(BatchJob.id == evaluation_id)
        bj_res = await self.db.execute(bj_stmt)
        b_job = bj_res.scalar_one_or_none()
        if b_job:
            if b_job.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to delete this evaluation."
                )
            await self.db.execute(delete(Evaluation).where(Evaluation.batch_job_id == b_job.id))
            await self.db.delete(b_job)
            await self.db.commit()
            return True

        # Record not found anywhere
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation record not found."
        )

    async def delete_all_evaluations(self, user_id: str, evaluation_type: Optional[str] = None) -> int:
        """Deletes all evaluation records for the authenticated user, optionally filtered by type.

        Only deletes records strictly where user_id == user_id.
        Never touches other users' records or chatbot configurations.
        """
        from app.models.testlab_run import TestLabRun
        from app.models.batch_job import BatchJob

        total_deleted = 0
        clean_type = (evaluation_type or "all").lower().strip()

        # 1. Single evaluations
        if clean_type in ("all", "single"):
            single_stmt = delete(Evaluation).where(
                Evaluation.user_id == user_id,
                Evaluation.batch_job_id.is_(None)
            )
            res = await self.db.execute(single_stmt)
            total_deleted += res.rowcount or 0

        # 2. Batch evaluations and batch jobs
        if clean_type in ("all", "batch"):
            batch_eval_stmt = delete(Evaluation).where(
                Evaluation.user_id == user_id,
                Evaluation.batch_job_id.is_not(None)
            )
            res = await self.db.execute(batch_eval_stmt)
            total_deleted += res.rowcount or 0

            bj_stmt = delete(BatchJob).where(BatchJob.user_id == user_id)
            await self.db.execute(bj_stmt)

        # 3. TestLab runs
        if clean_type in ("all", "testlab"):
            tl_stmt = delete(TestLabRun).where(TestLabRun.user_id == user_id)
            tl_res = await self.db.execute(tl_stmt)
            total_deleted += tl_res.rowcount or 0

        await self.db.commit()
        return total_deleted
