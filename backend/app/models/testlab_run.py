import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.chatbot import Chatbot


class TestLabRun(Base):
    __tablename__ = "testlab_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chatbot_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("chatbots.id", ondelete="SET NULL"), index=True, nullable=True
    )
    chatbot_name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_endpoint: Mapped[str] = mapped_column(String(500), nullable=False)
    test_suite: Mapped[str] = mapped_column(String(50), default="full", nullable=False)

    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    completed_tests: Mapped[int] = mapped_column(Integer, default=0)
    failed_tests: Mapped[int] = mapped_column(Integer, default=0)  # Technical execution errors
    passed_tests: Mapped[int] = mapped_column(Integer, default=0)
    potential_issue_tests: Mapped[int] = mapped_column(Integer, default=0)

    # Status: 'Pending', 'Running', 'Completed', 'Failed', 'Cancelled'
    status: Mapped[str] = mapped_column(String(20), default="Pending", index=True)
    current_test_index: Mapped[int] = mapped_column(Integer, default=0)
    current_test_name: Mapped[str] = mapped_column(String(255), default="")

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    summary_metrics_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    results_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="testlab_runs")
