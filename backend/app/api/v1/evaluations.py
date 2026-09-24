from datetime import datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_eval_registry
from app.evaluators.registry import EvaluationRegistry
from app.models.user import User
from app.schemas.evaluation import (
    EvaluationDetailResponse,
    EvaluationHistoryResponse,
    EvaluationListItem,
    RunEvaluationRequest,
)
from app.services.evaluation_service import EvaluationService

logger = logging.getLogger("verifa.api.evaluations")
router = APIRouter()


@router.post("/run", response_model=EvaluationDetailResponse, status_code=status.HTTP_201_CREATED)
async def run_evaluation(
    request_in: RunEvaluationRequest,
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Executes an evaluation of the user's chatbot response using the modular evaluation engine.

    Uses the pre-warmed Vectara HHEM model loaded once during startup to compute real factual consistency scores.
    """
    service = EvaluationService(db=db, eval_registry=eval_registry)
    try:
        result = await service.run_evaluation(
            user_id=current_user.id,
            request_in=request_in
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error executing evaluation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation failed: {str(e)}",
        )


@router.get("/history", response_model=EvaluationHistoryResponse)
async def get_evaluation_history(
    search: Optional[str] = None,
    chatbot_id: Optional[str] = None,
    evaluation_type: Optional[str] = Query(default=None, pattern="^(all|single|batch)$"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_by: str = Query(default="date_desc", pattern="^(date_desc|date_asc|score_desc|score_asc|latency_desc|latency_asc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves paginated, searchable, and filterable evaluation history strictly for the authenticated user."""
    service = EvaluationService(db=db, eval_registry=eval_registry)
    clean_type = None if evaluation_type == "all" else evaluation_type
    return await service.list_history(
        user_id=current_user.id,
        search=search,
        chatbot_id=chatbot_id,
        evaluation_type=clean_type,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )


@router.get("/export")
async def export_evaluations_csv(
    chatbot_id: Optional[str] = None,
    evaluation_type: Optional[str] = Query(default=None, pattern="^(all|single|batch)$"),
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Exports evaluations history as a downloadable CSV report for the authenticated user."""
    service = EvaluationService(db=db, eval_registry=eval_registry)
    clean_type = None if evaluation_type == "all" else evaluation_type
    csv_content = await service.export_history_csv(
        user_id=current_user.id,
        chatbot_id=chatbot_id,
        evaluation_type=clean_type,
    )
    filename = f"verifa_evaluations_export_{current_user.id[:8]}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/", response_model=List[EvaluationListItem])
async def list_evaluations(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Lists past evaluations saved in user history with summary risk metrics."""
    service = EvaluationService(db=db, eval_registry=eval_registry)
    return await service.list_evaluations(
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )


@router.get("/{evaluation_id}", response_model=EvaluationDetailResponse)
async def get_evaluation(
    evaluation_id: str,
    current_user: User = Depends(get_current_user),
    eval_registry: EvaluationRegistry = Depends(get_eval_registry),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full evaluation report including inputs, extracted chatbot response, and all metric breakdowns."""
    service = EvaluationService(db=db, eval_registry=eval_registry)
    result = await service.get_evaluation_detail(
        user_id=current_user.id,
        evaluation_id=evaluation_id
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation record not found.",
        )
    return result
