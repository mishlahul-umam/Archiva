from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, date

from database import get_db
from models import Document, User, DocumentStatus, UserRole
from schemas_doc_group import DocumentResponse
from routers.auth import get_current_user
from services.audit_service import log_action

router = APIRouter(tags=["Workflow"])

@router.get("/workflow/stats")
async def get_workflow_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.REVIEWER]:
        raise HTTPException(status_code=403, detail="Not authorized to access workflow stats")

    # Get Pending Count
    pending_res = await db.execute(select(Document).where(Document.status == DocumentStatus.PENDING))
    pending_count = len(pending_res.scalars().all())

    # Get Approved Today Count
    # In a real app, we might need a separate 'approved_at' timestamp or audit log check.
    # For simplicity, we'll just count ALL approved docs or check 'updated_at' if it was today.
    # Let's check updated_at for Approved status
    today = date.today()
    
    # We need to filter by status AND date. 
    # SQLAlchemy async filtering on dates can be tricky depending on DB, but let's try python side filtering for simplicity or standard SQL
    # Actually, let's just count ALL approved for now or filter.
    # Let's fetch all approved and filter in python for "today" to avoid complex SQL in this snippet.
    approved_res = await db.execute(select(Document).where(Document.status == DocumentStatus.APPROVED))
    approved_docs = approved_res.scalars().all()
    approved_today_count = sum(1 for d in approved_docs if d.updated_at and d.updated_at.date() == today)

    # Get Rejected Count (Total)
    rejected_res = await db.execute(select(Document).where(Document.status == DocumentStatus.REJECTED))
    rejected_count = len(rejected_res.scalars().all())

    return {
        "pending_review": pending_count,
        "approved_today": approved_today_count,
        "rejected_total": rejected_count
    }

@router.get("/workflow/pending", response_model=List[DocumentResponse])
async def get_pending_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Only SuperAdmin, Admin, and Reviewer can access workflow
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.REVIEWER]:
        raise HTTPException(status_code=403, detail="Not authorized to access workflows")

    result = await db.execute(select(Document).where(Document.status == DocumentStatus.PENDING).order_by(Document.created_at.desc()))
    documents = result.scalars().all()
    return documents

@router.post("/workflow/{doc_id}/approve")
async def approve_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.REVIEWER]:
        raise HTTPException(status_code=403, detail="Not authorized to approve documents")

    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document.status = DocumentStatus.APPROVED
    await log_action(db, current_user.id, "APPROVE_DOCUMENT", f"Approved document {doc_id}")
    await db.commit()
    return {"message": "Document approved"}

@router.post("/workflow/{doc_id}/reject")
async def reject_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.REVIEWER]:
        raise HTTPException(status_code=403, detail="Not authorized to reject documents")

    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document.status = DocumentStatus.REJECTED
    await log_action(db, current_user.id, "REJECT_DOCUMENT", f"Rejected document {doc_id}")
    await db.commit()
    return {"message": "Document rejected"}

@router.post("/workflow/{doc_id}/submit")
async def submit_for_approval(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Only Owner or Admin/Manager can submit
    # Usually owner submits their draft
    
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if document.status != DocumentStatus.DRAFT:
         raise HTTPException(status_code=400, detail="Document is not in draft status")

    document.status = DocumentStatus.PENDING
    await log_action(db, current_user.id, "SUBMIT_WORKFLOW", f"Submitted document {doc_id} for approval")
    await db.commit()
    return {"message": "Document submitted for approval"}
