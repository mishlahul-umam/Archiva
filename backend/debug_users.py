import asyncio
from sqlalchemy import select
from models import User
from database import AsyncSessionLocal

async def check_users():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Total users found: {len(users)}")
        for u in users:
            print(f"ID: {u.id}, Username: {u.username}, Email: {u.email}, First: {u.first_name}, Last: {u.last_name}")

if __name__ == "__main__":
    asyncio.run(check_users())
