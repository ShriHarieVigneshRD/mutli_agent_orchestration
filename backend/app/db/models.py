import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class ResearchRun(Base):
    __tablename__ = "research_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    query = Column(Text, nullable=False)
    provider = Column(String(50), default="groq")
    status = Column(String(30), default="pending")  # pending, running, completed, failed
    current_step = Column(String(50), default="initialized")
    revision_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    plan = relationship("ResearchPlan", back_populates="run", uselist=False, cascade="all, delete-orphan")
    logs = relationship("AgentRunLog", back_populates="run", cascade="all, delete-orphan")
    sources = relationship("Source", back_populates="run", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="run", uselist=False, cascade="all, delete-orphan")


class ResearchPlan(Base):
    __tablename__ = "research_plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("research_runs.id"), nullable=False)
    tasks = Column(JSON, nullable=False)  # List of sub-tasks
    agents_required = Column(JSON, nullable=False)  # List of agent names
    created_at = Column(DateTime, default=get_utc_now)

    run = relationship("ResearchRun", back_populates="plan")


class AgentRunLog(Base):
    __tablename__ = "agent_run_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("research_runs.id"), nullable=False)
    agent_name = Column(String(50), nullable=False)  # planner, researcher, data_analyst, news_agent, verifier, writer, critic
    status = Column(String(30), nullable=False)  # started, completed, failed
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=get_utc_now)

    run = relationship("ResearchRun", back_populates="logs")


class Source(Base):
    __tablename__ = "sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("research_runs.id"), nullable=False)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=True)
    snippet = Column(Text, nullable=True)
    source_type = Column(String(30), default="web")  # web, news, data
    confidence_score = Column(Float, default=1.0)
    created_at = Column(DateTime, default=get_utc_now)

    run = relationship("ResearchRun", back_populates="sources")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("research_runs.id"), nullable=False)
    title = Column(Text, nullable=False)
    executive_summary = Column(Text, nullable=True)
    full_markdown = Column(Text, nullable=False)
    critic_feedback = Column(Text, nullable=True)
    status = Column(String(30), default="final")  # draft, revised, final
    created_at = Column(DateTime, default=get_utc_now)

    run = relationship("ResearchRun", back_populates="report")
