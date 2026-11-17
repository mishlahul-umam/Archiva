import asyncio
import os
from database import AsyncSessionLocal
from models import User
from auth import get_password_hash
from sqlalchemy.future import select

async def create_superuser():
    async with AsyncSessionLocal() as session:
        username = input("Enter Superuser Username: ")
        email = input("Enter Superuser Email: ")
        password = input("Enter Superuser Password: ")
        
        # Check if user exists
        result = await session.execute(select(User).where(User.username == username))
        if result.scalars().first():
            print("Error: Username already exists.")
            return

        hashed_password = get_password_hash(password)
        
        new_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role="SuperAdmin",
            is_active=True
        )
        
        session.add(new_user)
        await session.commit()
        print(f"Superuser '{username}' created successfully!")

if __name__ == "__main__":
    asyncio.run(create_superuser())
