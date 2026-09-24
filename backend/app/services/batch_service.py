import csv
import io
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.evaluators.registry import EvaluationRegistry
from app.models.batch_job import BatchJob
from app.models.chatbot import Chatbot
from app.models.evaluation import Evaluation
from app.models.evaluation_metric import EvaluationMetric
from app.schemas.batch import (
    BatchJobProgress,
    BatchJobResponse,
    BatchRowResult,
    BatchSummary,
)

logger = logging.getLogger("verifa.services.batch")

MAX_BATCH_ROWS = 500
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_and_parse_csv(
    file_bytes: bytes, max_rows: int = MAX_BATCH_ROWS
) -> List[Dict[str, str]]:
    """Validates and parses CSV bytes into a list of row dictionaries.

    Expected columns:
        - prompt (or question, input)
        - response (or answer, output)
        - reference (optional, or evidence, context)
    """
    if not file_bytes or len(file_bytes) == 0:
        raise ValueError("The uploaded CSV file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError("File size exceeds maximum permitted limit (5MB).")

    try:
        # Decode UTF-8 (handling BOM if present)
        text_content = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = file_bytes.decode("latin-1")
        except Exception:
            raise ValueError("Unable to decode CSV file. Ensure it is UTF-8 encoded text.")

    # Read CSV
    stream = io.StringIO(text_content.strip())
    reader = csv.reader(stream)
    try:
        first_row = next(reader)
    except StopIteration:
        raise ValueError("CSV file has no data rows.")

    # Detect header columns (case-insensitive)
    lower_first = [col.strip().lower() for col in first_row]

    prompt_idx = -1
    response_idx = -1
    ref_idx = -1

    for idx, col in enumerate(lower_first):
        if col in ("prompt", "question", "input", "query", "user_prompt"):
            prompt_idx = idx
        elif col in ("response", "answer", "output", "chatbot_response", "completion"):
            response_idx = idx
        elif col in ("reference", "evidence", "context", "ground_truth", "source"):
            ref_idx = idx

    if prompt_idx == -1 or response_idx == -1:
        missing = []
        if prompt_idx == -1:
            missing.append("prompt")
        if response_idx == -1:
            missing.append("response")
        raise ValueError(
            f"Missing required columns in CSV: {', '.join(missing)}. "
            f"Found header: {first_row}. Expected at least 'prompt' and 'response' (optional: 'reference')."
        )

    data_rows = list(reader)
    parsed_rows: List[Dict[str, str]] = []

    for line_num, row in enumerate(data_rows, start=2):
        if not row or all(c.strip() == "" for c in row):
            continue  # skip completely blank rows

        if len(row) <= max(prompt_idx, response_idx):
            continue  # skip malformed truncated rows

        prompt_val = row[prompt_idx].strip()
        response_val = row[response_idx].strip()
        ref_val = row[ref_idx].strip() if ref_idx != -1 and len(row) > ref_idx else ""

        if not prompt_val and not response_val:
            continue

        if not prompt_val:
            raise ValueError(f"Row {line_num} has an empty prompt.")
        if not response_val:
            raise ValueError(f"Row {line_num} has an empty response.")

        parsed_rows.append({
            "prompt": prompt_val,
            "response": response_val,
            "reference": ref_val or None
        })

        if len(parsed_rows) > max_rows:
            raise ValueError(f"CSV contains more than the maximum allowed {max_rows} rows.")

    if not parsed_rows:
        raise ValueError("CSV contains no valid prompt-response rows.")

    return parsed_rows


class BatchService:
    """Handles execution and querying of asynchronous batch evaluation jobs."""

    def __init__(self, db: AsyncSession, eval_registry: EvaluationRegistry):
        self.db = db
        self.eval_registry = eval_registry

    async def create_batch_job(
        self,
        user_id: str,
        file_name: str,
        total_cases: int,
        chatbot_id: Optional[str] = None
    ) -> BatchJob:
        """Initializes and persists a new BatchJob record."""
        batch_job = BatchJob(
            user_id=user_id,
            chatbot_id=chatbot_id,
            file_name=file_name,
            total_cases=total_cases,
            completed_cases=0,
            failed_cases=0,
            status="processing"
        )
        self.db.add(batch_job)
        await self.db.commit()
        await self.db.refresh(batch_job)
        return batch_job

    @staticmethod
    async def process_batch_background(
        batch_job_id: str,
        user_id: str,
        chatbot_id: Optional[str],
        rows: List[Dict[str, str]],
        eval_registry: EvaluationRegistry
    ) -> None:
        """Asynchronously evaluates all rows in a batch job and saves results to DB."""
        logger.info(f"Starting background batch processing for job {batch_job_id} ({len(rows)} cases)...")
        start_time = time.perf_counter()

        async with async_session_maker() as session:
            try:
                # Process row by row
                for idx, row in enumerate(rows):
                    row_prompt = row["prompt"]
                    row_response = row["response"]
                    row_ref = row.get("reference")

                    try:
                        # Reuse the existing Phase 3 EvaluationRegistry and HHEM model
                        metric_results = await eval_registry.evaluate_metrics(
                            requested_metrics=["hallucination", "latency"],
                            prompt=row_prompt,
                            chatbot_response=row_response,
                            reference_evidence=row_ref,
                            latency_ms=0.0
                        )

                        # Create evaluation record
                        ev = Evaluation(
                            user_id=user_id,
                            chatbot_id=chatbot_id,
                            batch_job_id=batch_job_id,
                            prompt=row_prompt,
                            reference_evidence=row_ref,
                            chatbot_response=row_response,
                            status_code=200,
                            response_latency_ms=0.0,
                            status="success"
                        )
                        session.add(ev)
                        await session.flush()

                        for m_type, m_res in metric_results.items():
                            metric_row = EvaluationMetric(
                                evaluation_id=ev.id,
                                metric_type=m_type,
                                raw_score=m_res.raw_score,
                                normalized_score=m_res.normalized_score,
                                risk_level=m_res.risk_level,
                                status=m_res.status,
                                label=m_res.label,
                                details_json=json.dumps(m_res.details)
                            )
                            session.add(metric_row)

                        # Update batch progress in DB
                        stmt_update = select(BatchJob).where(BatchJob.id == batch_job_id)
                        job_res = await session.execute(stmt_update)
                        job = job_res.scalar_one_or_none()
                        if job:
                            job.completed_cases += 1
                        await session.commit()

                    except Exception as err:
                        logger.error(f"Error evaluating batch row {idx}: {str(err)}")
                        # Save error evaluation
                        ev_err = Evaluation(
                            user_id=user_id,
                            chatbot_id=chatbot_id,
                            batch_job_id=batch_job_id,
                            prompt=row_prompt,
                            reference_evidence=row_ref,
                            chatbot_response=row_response,
                            status_code=500,
                            response_latency_ms=0.0,
                            status="error",
                            error_message=str(err)
                        )
                        session.add(ev_err)
                        stmt_update = select(BatchJob).where(BatchJob.id == batch_job_id)
                        job_res = await session.execute(stmt_update)
                        job = job_res.scalar_one_or_none()
                        if job:
                            job.failed_cases += 1
                        await session.commit()

                # Mark completed
                elapsed = time.perf_counter() - start_time
                stmt_final = select(BatchJob).where(BatchJob.id == batch_job_id)
                res_final = await session.execute(stmt_final)
                final_job = res_final.scalar_one_or_none()
                if final_job:
                    final_job.status = "completed"
                    final_job.completed_at = datetime.now(timezone.utc)
                    await session.commit()
                logger.info(f"Batch job {batch_job_id} completed successfully in {elapsed:.2f}s.")

            except Exception as e:
                logger.error(f"Fatal error in batch job {batch_job_id}: {str(e)}", exc_info=True)
                stmt_err = select(BatchJob).where(BatchJob.id == batch_job_id)
                res_err = await session.execute(stmt_err)
                job = res_err.scalar_one_or_none()
                if job:
                    job.status = "failed"
                    await session.commit()

    async def get_batch_job_detail(
        self, batch_job_id: str, user_id: str
    ) -> Optional[BatchJobResponse]:
        """Retrieves batch job status, summary analytics, and all row results."""
        stmt = (
            select(BatchJob)
            .options(
                selectinload(BatchJob.evaluations).selectinload(Evaluation.metrics),
                selectinload(BatchJob.user)
            )
            .where(
                BatchJob.id == batch_job_id,
                BatchJob.user_id == user_id
            )
        )
        res = await self.db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            return None

        chatbot_name = "Offline / Benchmark CSV"
        if job.chatbot_id:
            cb_stmt = select(Chatbot).where(Chatbot.id == job.chatbot_id)
            cb_res = await self.db.execute(cb_stmt)
            cb = cb_res.scalar_one_or_none()
            if cb:
                chatbot_name = cb.name

        results: List[BatchRowResult] = []
        scores: List[float] = []
        low_count = 0
        med_count = 0
        high_count = 0

        # Sort evaluations by creation order
        sorted_evals = sorted(job.evaluations, key=lambda x: x.created_at or datetime.min)

        for idx, ev in enumerate(sorted_evals, start=1):
            h_metric = next((m for m in ev.metrics if m.metric_type == "hallucination"), None)
            score = h_metric.raw_score if h_metric else None
            risk = h_metric.risk_level if h_metric else "unknown"

            if score is not None:
                scores.append(score)
                if risk == "low":
                    low_count += 1
                elif risk == "medium":
                    med_count += 1
                elif risk == "high":
                    high_count += 1

            results.append(
                BatchRowResult(
                    row_index=idx,
                    prompt=ev.prompt,
                    response=ev.chatbot_response,
                    reference=ev.reference_evidence,
                    hhem_score=score,
                    risk_level=risk,
                    status=ev.status,
                    error_message=ev.error_message
                )
            )

        avg_score = round(sum(scores) / len(scores), 4) if scores else None

        processing_seconds = 0.0
        if job.completed_at and job.created_at:
            processing_seconds = round((job.completed_at - job.created_at).total_seconds(), 2)

        summary = BatchSummary(
            total_cases=job.total_cases,
            completed_cases=job.completed_cases,
            failed_cases=job.failed_cases,
            average_hhem_score=avg_score,
            low_risk_count=low_count,
            medium_risk_count=med_count,
            high_risk_count=high_count,
            processing_time_seconds=processing_seconds
        )

        return BatchJobResponse(
            id=job.id,
            chatbot_id=job.chatbot_id,
            chatbot_name=chatbot_name,
            file_name=job.file_name,
            status=job.status,
            total_cases=job.total_cases,
            completed_cases=job.completed_cases,
            failed_cases=job.failed_cases,
            created_at=job.created_at,
            completed_at=job.completed_at,
            summary=summary,
            results=results
        )

    async def get_batch_job_progress(
        self, batch_job_id: str, user_id: str
    ) -> Optional[BatchJobProgress]:
        """Returns lightweight progress metrics for polling."""
        stmt = select(BatchJob).where(
            BatchJob.id == batch_job_id,
            BatchJob.user_id == user_id
        )
        res = await self.db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            return None

        total = max(1, job.total_cases)
        processed = job.completed_cases + job.failed_cases
        percentage = round(min(100.0, (processed / total) * 100.0), 1)

        return BatchJobProgress(
            id=job.id,
            status=job.status,
            total_cases=job.total_cases,
            completed_cases=job.completed_cases,
            failed_cases=job.failed_cases,
            progress_percentage=percentage
        )

    async def generate_csv_report(self, batch_job_id: str, user_id: str) -> str:
        """Generates downloadable CSV text from completed batch evaluation results."""
        detail = await self.get_batch_job_detail(batch_job_id, user_id)
        if not detail:
            raise ValueError("Batch job not found.")

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "row_index",
            "prompt",
            "response",
            "reference",
            "hhem_consistency_score",
            "risk_level",
            "status",
            "error_message"
        ])

        for row in detail.results:
            writer.writerow([
                row.row_index,
                row.prompt,
                row.response,
                row.reference or "",
                f"{row.hhem_score:.4f}" if row.hhem_score is not None else "",
                row.risk_level,
                row.status,
                row.error_message or ""
            ])

        return output.getvalue()
