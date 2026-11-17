import asyncio
from sqlalchemy import text
from database import AsyncSessionLocal

async def update_admin_name():
    async with AsyncSessionLocal() as session:
        # Update Admin User
        try:
            await session.execute(text("UPDATE users SET first_name='Admin', last_name='User' WHERE username='admin'"))
            await session.commit()
            print("Updated admin user name to 'Admin User'")
        except Exception as e:
            print(f"Failed to update admin user: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(update_admin_name())
