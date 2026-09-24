import uuid
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.evaluation import Evaluation


class Chatbot(Base):
    __tablename__ = "chatbots"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_endpoint: Mapped[str] = mapped_column(String(500), nullable=False)
    encrypted_api_key: Mapped[str] = mapped_column(Text, default="", nullable=False)
    http_method: Mapped[str] = mapped_column(String(10), default="POST")
    request_template: Mapped[str] = mapped_column(
        Text,
        default='{"messages": [{"role": "user", "content": "{{prompt}}"}]}',
        nullable=False,
    )
    response_json_path: Mapped[str] = mapped_column(
        String(255), default="choices[0].message.content", nullable=False
    )
    custom_headers_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="chatbots")
    evaluations: Mapped[List["Evaluation"]] = relationship(
        "Evaluation", back_populates="chatbot", cascade="all, delete-orphan"
    )
