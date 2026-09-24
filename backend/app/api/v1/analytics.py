from datetime import datetime
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.analytics import AnalyticsOverviewResponse
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger("verifa.api.analytics")
router = APIRouter()


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    time_filter: str = Query(default="30d", pattern="^(7d|30d|90d|all|custom)$"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves real aggregate analytics and trend metrics for the authenticated user."""
    service = AnalyticsService(db=db)
    return await service.get_overview(
        user_id=current_user.id,
        time_filter=time_filter,
        start_date=start_date,
        end_date=end_date,
    )
