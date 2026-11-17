from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from schemas_doc_group import DocumentResponse

class CabinetBase(BaseModel):
    name: str
    parent_id: Optional[int] = None

class CabinetCreate(CabinetBase):
    pass

class CabinetUpdate(CabinetBase):
    name: Optional[str] = None

class CabinetResponse(CabinetBase):
    id: int
    owner_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class CabinetTree(CabinetResponse):
    children: List['CabinetTree'] = Field(default_factory=list)

class CabinetDetail(CabinetResponse):
    documents: List[DocumentResponse] = []
