from pydantic import BaseModel
from typing import Optional

class StorageStats(BaseModel):
    total_used: int
    total_limit: int
    documents_size: int
    images_size: int
    others_size: int

class DashboardStats(BaseModel):
    total_documents: int
    pending_approvals: int
    expiring_soon: int
    processed_today: int
    storage_usage: StorageStats
