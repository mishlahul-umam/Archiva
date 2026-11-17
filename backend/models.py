from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(str, enum.Enum):
    SUPERADMIN = "SuperAdmin"
    ADMIN = "Admin"
    DOCUMENT_MANAGER = "DocumentManager"
    REVIEWER = "Reviewer"
    VIEWER = "Viewer"

class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default=UserRole.VIEWER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("Document", back_populates="owner")
    audit_logs = relationship("AuditLog", back_populates="user")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(String, default=DocumentStatus.DRAFT)
    version = Column(Integer, default=1)
    
    ocr_content = Column(Text, nullable=True)  # Store extracted text
    ai_metadata = Column(JSONB, nullable=True) # Store AI extracted metadata
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="documents")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    relationships_source = relationship("DocumentRelationship", foreign_keys="[DocumentRelationship.source_id]", back_populates="source_doc")
    relationships_target = relationship("DocumentRelationship", foreign_keys="[DocumentRelationship.target_id]", back_populates="target_doc")

    # Cabinets
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=True)
    cabinet = relationship("Cabinet", back_populates="documents")

class Cabinet(Base):
    __tablename__ = "cabinets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("cabinets.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    parent = relationship("Cabinet", remote_side=[id], backref="children")
    documents = relationship("Document", back_populates="cabinet")
    owner = relationship("User")

class DocumentRelationship(Base):
    __tablename__ = "document_relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("documents.id"))
    target_id = Column(Integer, ForeignKey("documents.id"))
    relationship_type = Column(String, nullable=False) # e.g. "related_to", "supersedes"
    
    source_doc = relationship("Document", foreign_keys=[source_id], back_populates="relationships_source")
    target_doc = relationship("Document", foreign_keys=[target_id], back_populates="relationships_target")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String, nullable=False) # e.g., "UPLOAD", "DELETE", "LOGIN"
    details = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
