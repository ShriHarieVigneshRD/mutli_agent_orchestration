import asyncio
from app.db.database import init_db, engine

async def test():
    print("Testing connection to database...")
    await init_db()
    print("Database connection & tables initialized successfully!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())
