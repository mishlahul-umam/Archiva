import asyncio
from database import AsyncSessionLocal
from models import User
from auth import get_password_hash
from sqlalchemy.future import select

async def create_default_admin():
    async with AsyncSessionLocal() as session:
        # Check if admin exists
        result = await session.execute(select(User).where(User.username == "admin"))
        if result.scalars().first():
            print("Admin user already exists.")
            return

        hashed_password = get_password_hash("admin")
        
        new_user = User(
            username="admin",
            email="admin@archiva.com",
            hashed_password=hashed_password,
            role="SuperAdmin",
            is_active=True
        )
        
        session.add(new_user)
        await session.commit()
        print("Default Superuser created!")
        print("Username: admin")
        print("Password: admin")

if __name__ == "__main__":
    asyncio.run(create_default_admin())
