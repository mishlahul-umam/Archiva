from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class DocumentStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class DocumentBase(BaseModel):
    title: str
    filename: str
    file_type: str
    file_size: int
    status: DocumentStatus = DocumentStatus.DRAFT

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    file_path: str
    version: int
    ocr_content: Optional[str] = None
    ai_metadata: Optional[Dict[str, Any]] = None
    owner_id: int
    cabinet_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class GroupCreate(GroupBase):
    pass

class GroupResponse(GroupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
