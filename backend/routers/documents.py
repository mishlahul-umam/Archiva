from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from typing import List, Optional
import shutil
import os
from datetime import datetime
import asyncio
import io

# OCR Imports
import pytesseract
from PIL import Image
import pymupdf  # Import PyMuPDF

# Backport for Python < 3.9
try:
    from typing import Annotated
except ImportError:
    from typing_extensions import Annotated

from database import get_db, AsyncSessionLocal
from models import Document, User, DocumentStatus, UserRole
from schemas_doc_group import DocumentResponse
from routers.auth import get_current_user
from services.ai_service import extract_metadata
from services.audit_service import log_action

router = APIRouter(tags=["Documents"])

UPLOAD_DIR = "uploads"

# Helper to check if Tesseract is available
def is_tesseract_installed():
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False

async def process_ocr(document_id: int, file_path: str):
    extracted_text = ""
    error_message = None

    try:
        # Determine file type
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == ".pdf":
            # Use PyMuPDF for text extraction from PDFs
            try:
                # Open the PDF file
                doc = pymupdf.open(file_path)
                text = ""
                for page in doc:
                    text += page.get_text() + "\n"
                
                extracted_text = text.strip()
                
                # If no text found, try OCR on images within PDF if Tesseract is available
                if not extracted_text:
                    if is_tesseract_installed():
                         # Clean text, don't add "Info" prefix
                         for page_num, page in enumerate(doc):
                            pix = page.get_pixmap()
                            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                            # Offload blocking IO to thread
                            loop = asyncio.get_event_loop()
                            page_text = await loop.run_in_executor(None, lambda: pytesseract.image_to_string(img))
                            extracted_text += f"{page_text}\n"
                         extracted_text = extracted_text.strip()
                    else:
                        extracted_text = "[OCR Info] No text layer found in PDF. Scanned PDF OCR requires Tesseract."
                
                doc.close()

            except Exception as e:
                error_message = f"PDF processing failed: {str(e)}"

        elif file_ext in [".jpg", ".jpeg", ".png", ".bmp", ".tiff"]:
            # Use Tesseract for Images
            if is_tesseract_installed():
                try:
                    # Offload blocking IO to thread
                    loop = asyncio.get_event_loop()
                    text = await loop.run_in_executor(None, lambda: pytesseract.image_to_string(Image.open(file_path)))
                    extracted_text = text.strip()
                except Exception as e:
                     error_message = f"Image OCR failed: {str(e)}"
            else:
                 extracted_text = "[OCR Warning] Tesseract-OCR is not installed or not in PATH. Please install it to enable image OCR."
        
        else:
            extracted_text = f"File type {file_ext} not supported for automatic text extraction."

    except Exception as e:
        error_message = f"General processing error: {str(e)}"

    # Update Database with OCR content and AI Metadata
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Document).where(Document.id == document_id))
        document = result.scalars().first()
        if document:
            if error_message:
                document.ocr_content = f"[Error] {error_message}"
            else:
                document.ocr_content = extracted_text if extracted_text else "[OCR Info] No text could be extracted."
                
                # AI Metadata Extraction
                if extracted_text and not error_message:
                    try:
                        ai_data = await extract_metadata(extracted_text)
                        document.ai_metadata = ai_data
                    except Exception as e:
                        print(f"AI Extraction failed: {e}")
            
            await session.commit()
            print(f"OCR & AI processed for document {document_id}")

@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # RBAC Check: Only SuperAdmin, Admin, and DocumentManager can upload
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DOCUMENT_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to upload documents"
        )

    # Ensure upload dir exists
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    # Save file
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = os.path.getsize(file_path)

    new_doc = Document(
        title=title,
        filename=filename,
        file_path=file_path,
        file_type=file.content_type or "unknown",
        file_size=file_size,
        owner_id=current_user.id,
        status=DocumentStatus.DRAFT
    )
    
    db.add(new_doc)
    await log_action(db, current_user.id, "UPLOAD", f"Uploaded document: {filename}")
    await db.commit()
    await db.refresh(new_doc)
    
    # Trigger Background OCR
    background_tasks.add_task(process_ocr, new_doc.id, file_path)
    
    return new_doc

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, min_length=3), # Add search query param
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # All roles can list documents (Viewer and above)
    query = select(Document).order_by(Document.created_at.desc())
    
    if search:
        search_filter = f"%{search}%"
        # Search in title, filename, and ocr_content
        query = query.where(
            or_(
                Document.title.ilike(search_filter),
                Document.filename.ilike(search_filter),
                Document.ocr_content.ilike(search_filter)
            )
        )
    
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    return documents

@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # All roles can download/view
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    await log_action(db, current_user.id, "DOWNLOAD", f"Downloaded document: {document.filename}")
    await db.commit() # Commit log

    return FileResponse(document.file_path, filename=document.filename)

@router.get("/documents/{doc_id}/ocr")
async def get_document_ocr(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # All roles can view OCR
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {"text": document.ocr_content, "ai_metadata": document.ai_metadata}

@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # RBAC Check for Deletion
    # SuperAdmin and Admin can delete ANY document
    # DocumentManager can only delete their OWN documents
    # Others cannot delete
    
    can_delete = False
    if current_user.role in [UserRole.SUPERADMIN, UserRole.ADMIN]:
        can_delete = True
    elif current_user.role == UserRole.DOCUMENT_MANAGER:
        if document.owner_id == current_user.id:
            can_delete = True
    
    if not can_delete:
        raise HTTPException(status_code=403, detail="Not authorized to delete this document")

    # Delete file from disk
    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")

    await db.delete(document)
    await log_action(db, current_user.id, "DELETE", f"Deleted document: {document.filename}")
    await db.commit()
    return None
