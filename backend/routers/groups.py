from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
from models import Group, User, UserRole
from schemas_doc_group import GroupResponse, GroupCreate
from routers.auth import get_current_user

router = APIRouter(tags=["Groups"])

@router.post("/groups", response_model=GroupResponse)
async def create_group(
    group: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to create groups")
        
    result = await db.execute(select(Group).where(Group.name == group.name))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Group already exists")

    new_group = Group(name=group.name, description=group.description)
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    return new_group

@router.get("/groups", response_model=List[GroupResponse])
async def list_groups(
    skip: int = 0, 
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Group).offset(skip).limit(limit))
    return result.scalars().all()
