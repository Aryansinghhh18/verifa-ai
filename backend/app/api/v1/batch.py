import logging
from typing import List, Optional
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_eval_registry
from app.evaluators.registry import EvaluationRegistry
from app.models.batch_job import BatchJob
from app.models.user import User
from app.schemas.batch import (
    BatchJobProgress,
    BatchJobResponse,
)
from app.services.batch_service import (
    BatchService,
    validate_and_parse_csv,
)

logger = logging.getLogger("verifa.api.batch")
router = APIRouter()


@router.post("/upload", response_model=BatchJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_batch_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="CSV file with 'prompt' and 'response' columns"),
    chatbot_id: Optional[str] = Form(None, description="Optional chatbot to associate with this batch"),
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Uploads a CSV file to initiate an asynchronous batch evaluation job."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only CSV (.csv) files are supported.",
        )

    file_bytes = await file.read()
    try:
        rows = validate_and_parse_csv(file_bytes)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    batch_service = BatchService(db=db, eval_registry=eval_registry)
    clean_chatbot_id = chatbot_id.strip() if chatbot_id and chatbot_id.strip() else None

    # Create batch job in DB
    batch_job = await batch_service.create_batch_job(
        user_id=current_user.id,
        file_name=file.filename,
        total_cases=len(rows),
        chatbot_id=clean_chatbot_id,
    )

    # Dispatch asynchronous background evaluation using existing Phase 3 engine
    background_tasks.add_task(
        BatchService.process_batch_background,
        batch_job.id,
        current_user.id,
        clean_chatbot_id,
        rows,
        eval_registry,
    )

    return await batch_service.get_batch_job_detail(batch_job.id, current_user.id)


@router.get("/{batch_job_id}/progress", response_model=BatchJobProgress)
async def get_batch_progress(
    batch_job_id: str,
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Polls real-time progress for an active batch evaluation job."""
    service = BatchService(db=db, eval_registry=eval_registry)
    progress = await service.get_batch_job_progress(batch_job_id, current_user.id)
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch job not found.",
        )
    return progress


@router.get("/{batch_job_id}", response_model=BatchJobResponse)
async def get_batch_detail(
    batch_job_id: str,
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full batch job results and summary metrics."""
    service = BatchService(db=db, eval_registry=eval_registry)
    detail = await service.get_batch_job_detail(batch_job_id, current_user.id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch job not found.",
        )
    return detail


@router.get("/{batch_job_id}/export")
async def export_batch_csv(
    batch_job_id: str,
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Exports batch evaluation results as a downloadable CSV report."""
    service = BatchService(db=db, eval_registry=eval_registry)
    try:
        csv_data = await service.generate_csv_report(batch_job_id, current_user.id)
        filename = f"verifa_batch_report_{batch_job_id[:8]}.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/", response_model=List[BatchJobResponse])
async def list_batch_jobs(
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Lists recent batch jobs created by the authenticated user."""
    stmt = (
        select(BatchJob)
        .where(BatchJob.user_id == current_user.id)
        .order_by(BatchJob.created_at.desc())
        .limit(20)
    )
    res = await db.execute(stmt)
    jobs = res.scalars().all()

    service = BatchService(db=db, eval_registry=eval_registry)
    results = []
    for job in jobs:
        detail = await service.get_batch_job_detail(job.id, current_user.id)
        if detail:
            results.append(detail)
    return results
