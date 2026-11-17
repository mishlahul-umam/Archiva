from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from models import AuditLog, User
from schemas import AuditLogResponse
from routers.auth import get_current_user

router = APIRouter(tags=["Audit"])

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Not authorized to view audit logs")

    # Eager load user to get username
    result = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()
    
    # Map to response (flatten username)
    response = []
    for log in logs:
        response.append(AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            username=log.user.username if log.user else "System",
            action=log.action,
            details=log.details,
            timestamp=log.timestamp
        ))
        
    return response
