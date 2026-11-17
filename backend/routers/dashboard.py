from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case
from datetime import datetime, timedelta
import shutil
import os

from database import get_db
from models import Document, DocumentStatus
from schemas_dashboard import DashboardStats, StorageStats
from routers.auth import get_current_user

router = APIRouter(tags=["Dashboard"])

UPLOAD_DIR = "uploads"

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Total Documents
    result_total = await db.execute(select(func.count(Document.id)))
    total_documents = result_total.scalar() or 0

    # Pending Approvals
    result_pending = await db.execute(select(func.count(Document.id)).where(Document.status == DocumentStatus.PENDING))
    pending_approvals = result_pending.scalar() or 0

    # Expiring Soon (Placeholder: 0 as we don't have expiry_date yet)
    expiring_soon = 0

    # Processed Today (Created today)
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    result_today = await db.execute(select(func.count(Document.id)).where(Document.created_at >= today_start))
    processed_today = result_today.scalar() or 0

    # Storage Usage
    # Total Used by Archiva (DB sum)
    result_size = await db.execute(select(func.sum(Document.file_size)))
    total_used = result_size.scalar() or 0
    
    # Categorize by mime type
    result_files = await db.execute(select(Document.file_type, Document.file_size))
    files = result_files.all()
    
    documents_size = 0
    images_size = 0
    others_size = 0
    
    # Define simple categories
    doc_types = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    image_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    for file_type, file_size in files:
        if any(dt in file_type for dt in doc_types):
            documents_size += file_size
        elif any(it in file_type for it in image_types):
            images_size += file_size
        else:
            others_size += file_size

    # Real System Storage Capacity
    # Ensure upload dir exists to check its usage
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)
        
    try:
        # Get disk usage for the drive containing the upload directory
        total_disk, used_disk, free_disk = shutil.disk_usage(UPLOAD_DIR)
        total_limit = total_disk
    except Exception:
        # Fallback if shutil fails for some reason
        total_limit = 100 * 1024 * 1024 * 1024 # 100GB default

    return DashboardStats(
        total_documents=total_documents,
        pending_approvals=pending_approvals,
        expiring_soon=expiring_soon,
        processed_today=processed_today,
        storage_usage=StorageStats(
            total_used=total_used,
            total_limit=total_limit,
            documents_size=documents_size,
            images_size=images_size,
            others_size=others_size
        )
    )
