"""ORM models. Column types, lengths and nullability match the tables already deployed on Neon;
`create_all` only creates missing tables, so changing an existing column here needs a migration."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def get_utc_now() -> datetime:
    """Naive UTC: the deployed DateTime columns have no time zone."""
    return datetime.now(UTC).replace(tzinfo=None)


class ResearchRun(Base):
    __tablename__ = "research_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    # Holds the model setting: a model id, or "per-agent". The name predates model routing.
    provider: Mapped[str] = mapped_column(String(50), default="groq", nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=True)
    current_step: Mapped[str] = mapped_column(String(50), default="initialized", nullable=True)
    revision_count: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=True
    )

    plan = relationship("ResearchPlan", back_populates="run", uselist=False, cascade="all, delete-orphan")
    logs = relationship("AgentRunLog", back_populates="run", cascade="all, delete-orphan")
    sources = relationship("Source", back_populates="run", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="run", uselist=False, cascade="all, delete-orphan")
    chat_messages = relationship(
        "ChatMessage",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
    )


class ResearchPlan(Base):
    __tablename__ = "research_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id"), nullable=False)
    tasks: Mapped[Any] = mapped_column(JSON, nullable=False)
    agents_required: Mapped[Any] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=True)

    run = relationship("ResearchRun", back_populates="plan")


class AgentRunLog(Base):
    __tablename__ = "agent_run_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id"), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    details: Mapped[Any] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=True)

    run = relationship("ResearchRun", back_populates="logs")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(30), default="web", nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, default=1.0, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=True)

    run = relationship("ResearchRun", back_populates="sources")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    executive_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    critic_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="final", nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=True)

    run = relationship("ResearchRun", back_populates="report")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=True)

    run = relationship("ResearchRun", back_populates="chat_messages")
