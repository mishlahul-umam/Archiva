from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from models import Cabinet, Document, User, UserRole
from schemas_cabinets import CabinetCreate, CabinetUpdate, CabinetResponse, CabinetTree, CabinetDetail
from routers.auth import get_current_user

router = APIRouter(prefix="/cabinets", tags=["Cabinets"])

@router.post("/", response_model=CabinetResponse)
async def create_cabinet(
    cabinet: CabinetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_cabinet = Cabinet(
        name=cabinet.name,
        parent_id=cabinet.parent_id,
        owner_id=current_user.id
    )
    db.add(new_cabinet)
    await db.commit()
    await db.refresh(new_cabinet)
    return new_cabinet

@router.get("/", response_model=List[CabinetTree])
async def list_cabinets_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Cabinet))
    cabinets = result.scalars().all()
    
    # Build tree manually
    # Use CabinetResponse to validate/dump to avoid triggering 'children' relationship load
    cabinet_map = {}
    for c in cabinets:
        base_data = CabinetResponse.model_validate(c).model_dump()
        cabinet_map[c.id] = CabinetTree(**base_data)

    roots = []
    
    for c in cabinets:
        if c.parent_id:
            if c.parent_id in cabinet_map:
                cabinet_map[c.parent_id].children.append(cabinet_map[c.id])
        else:
            roots.append(cabinet_map[c.id])
            
    return roots

@router.get("/{cabinet_id}", response_model=CabinetDetail)
async def get_cabinet(
    cabinet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Cabinet)
        .options(selectinload(Cabinet.documents))
        .where(Cabinet.id == cabinet_id)
    )
    cabinet = result.scalars().first()
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")
    return cabinet

@router.put("/{cabinet_id}", response_model=CabinetResponse)
async def update_cabinet(
    cabinet_id: int,
    cabinet_update: CabinetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Cabinet).where(Cabinet.id == cabinet_id))
    cabinet = result.scalars().first()
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")
        
    if cabinet_update.name:
        cabinet.name = cabinet_update.name
    if cabinet_update.parent_id is not None:
        # Check for cycles? For now, skip complex cycle check.
        if cabinet_update.parent_id == cabinet_id:
             raise HTTPException(status_code=400, detail="Cannot be parent of self")
        cabinet.parent_id = cabinet_update.parent_id
        
    await db.commit()
    await db.refresh(cabinet)
    return cabinet

@router.delete("/{cabinet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cabinet(
    cabinet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Cabinet).where(Cabinet.id == cabinet_id))
    cabinet = result.scalars().first()
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")
        
    children_res = await db.execute(select(Cabinet).where(Cabinet.parent_id == cabinet_id))
    if children_res.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete cabinet with sub-cabinets")
        
    await db.delete(cabinet)
    await db.commit()
    return None

@router.post("/{cabinet_id}/documents/{document_id}")
async def add_document_to_cabinet(
    cabinet_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if cabinet exists
    cab_res = await db.execute(select(Cabinet).where(Cabinet.id == cabinet_id))
    cabinet = cab_res.scalars().first()
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet not found")
        
    # Check if document exists
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_res.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update document's cabinet_id (Move if already in another cabinet)
    document.cabinet_id = cabinet_id
    await db.commit()
        
    return {"status": "added"}

@router.delete("/{cabinet_id}/documents/{document_id}")
async def remove_document_from_cabinet(
    cabinet_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if document exists and is in this cabinet
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_res.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if document.cabinet_id == cabinet_id:
        document.cabinet_id = None
        await db.commit()
        
    return {"status": "removed"}
