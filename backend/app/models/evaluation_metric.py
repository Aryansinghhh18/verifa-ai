import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.evaluation import Evaluation


class EvaluationMetric(Base):
    __tablename__ = "evaluation_metrics"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    evaluation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("evaluations.id", ondelete="CASCADE"), index=True, nullable=False
    )

    metric_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    raw_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    normalized_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(20), default="unknown")  # low, medium, high, unknown
    status: Mapped[str] = mapped_column(String(20), default="evaluated")  # evaluated, coming_soon, error
    label: Mapped[str] = mapped_column(String(100), default="")
    details_json: Mapped[str] = mapped_column(Text, default="{}")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="metrics")
