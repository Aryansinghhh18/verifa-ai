import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.chatbot import Chatbot
    from app.models.evaluation_metric import EvaluationMetric
    from app.models.batch_job import BatchJob


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chatbot_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("chatbots.id", ondelete="SET NULL"), index=True, nullable=True
    )
    batch_job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("batch_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )

    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    reference_evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chatbot_response: Mapped[str] = mapped_column(Text, default="", nullable=False)

    status_code: Mapped[int] = mapped_column(Integer, default=200)
    response_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="success")  # "success" or "error"
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="evaluations")
    chatbot: Mapped["Chatbot"] = relationship("Chatbot", back_populates="evaluations")
    batch_job: Mapped[Optional["BatchJob"]] = relationship("BatchJob", back_populates="evaluations")
    metrics: Mapped[List["EvaluationMetric"]] = relationship(
        "EvaluationMetric", back_populates="evaluation", cascade="all, delete-orphan"
    )
