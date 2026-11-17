import re

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

raw_db_url = settings.DATABASE_URL.strip().strip('"').strip("'")

# Adjust dialect for async SQLAlchemy
if raw_db_url.startswith("postgresql://"):
    raw_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("sqlite://") and not raw_db_url.startswith("sqlite+aiosqlite://"):
    raw_db_url = raw_db_url.replace("sqlite://", "sqlite+aiosqlite://", 1)


# Clean up query params for asyncpg compatibility
if "postgresql+asyncpg" in raw_db_url:
    raw_db_url = re.sub(r"[&?]channel_binding=[^&]+", "", raw_db_url)
    raw_db_url = raw_db_url.replace("sslmode=require", "ssl=require")

connect_args = {}
if "sqlite" in raw_db_url:
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    raw_db_url, echo=False, connect_args=connect_args if "sqlite" in raw_db_url else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


class Base(DeclarativeBase):
    pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
