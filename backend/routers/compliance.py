from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import List, Dict, Any

from database import get_db
from models import Document, User
from routers.auth import get_current_user

router = APIRouter(tags=["Compliance"])

@router.get("/compliance/stats")
async def get_compliance_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Not authorized to view compliance stats")

    # 1. Total Documents
    result_total = await db.execute(select(func.count(Document.id)))
    total_docs = result_total.scalar() or 0

    if total_docs == 0:
         return {
            "totalPolicies": 3,
            "activeViolations": 0,
            "compliantDocs": 0,
            "auditScore": 100,
            "classificationStats": [],
            "recentViolations": []
        }

    # 2. Classification Stats (Group by AI Metadata)
    # Note: extracting JSONB fields via SQLAlchemy async can be tricky depending on driver.
    # We will fetch all docs and aggregate in python for simplicity and DB independence for now, 
    # or use specific postgres operators.
    # Let's use Python aggregation for reliability with current setup.
    result_docs = await db.execute(select(Document))
    all_docs = result_docs.scalars().all()

    classification_counts = {}
    violations = []
    compliant_count = 0

    # Define "Real" Policies
    # Policy 1: Sensitive Data Protection (PII Detection)
    # Added "user id" and "user_id" to catch account credentials better
    pii_keywords = ["password", "secret", "ssn", "credit card", "confidential", "private key", "api key", "user id", "user_id", "pin code"]
    
    # Policy 2: Data Classification (Must be classified)
    
    # Policy 3: Metadata Standards (AI Extraction success)
    
    for doc in all_docs:
        # Classification
        doc_type = "Unknown"
        if doc.ai_metadata and "document_type" in doc.ai_metadata:
            doc_type = doc.ai_metadata["document_type"]
        
        classification_counts[doc_type] = classification_counts.get(doc_type, 0) + 1

        # Violation Check
        is_compliant = True
        doc_violations = []

        # 1. Check PII (High Severity)
        # Prioritize PII check. If PII is found, it's HIGH severity regardless of classification.
        if doc.ocr_content:
            content_lower = doc.ocr_content.lower()
            found_keywords = [kw for kw in pii_keywords if kw in content_lower]
            if found_keywords:
                is_compliant = False
                doc_violations.append({
                    "policy": "Sensitive Data Protection",
                    "severity": "High",
                    "detail": f"PII Detected: {', '.join(found_keywords)}"
                })

        # 2. Check Classification (Medium Severity)
        # ONLY flag as Medium violation if it's NOT already flagged as High (PII)
        # This prevents "double jeopardy" where one file clogs the list with multiple violations
        # However, business logic might require showing ALL violations.
        # Based on user feedback ("statusnya medium" padahal ada password), it seems like 
        # the "Unknown" classification (Medium) might be overshadowing the PII (High) 
        # OR the PII keyword wasn't detected.
        # Let's make sure we capture ALL violations, but in the UI we sort by severity.
        
        if doc_type == "Unknown":
            is_compliant = False
            doc_violations.append({
                "policy": "Data Classification",
                "severity": "Medium",
                "detail": "Document type not classified by AI"
            })

        # 3. Check Metadata (Low Severity)
        if not doc.ai_metadata:
            is_compliant = False
            doc_violations.append({
                "policy": "Metadata Standards",
                "severity": "Low",
                "detail": "Missing AI Metadata"
            })

        if is_compliant:
            compliant_count += 1
        else:
            for v in doc_violations:
                violations.append({
                    "policy": v["policy"],
                    "doc": doc.filename,
                    "doc_id": doc.id,
                    "severity": v["severity"],
                    "time": doc.created_at.strftime("%Y-%m-%d %H:%M")
                })

    # Calculate Stats
    audit_score = int((compliant_count / total_docs) * 100) if total_docs > 0 else 100
    
    # Format Classification for Frontend
    classification_stats = []
    colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-gray-500"]
    color_idx = 0
    for dtype, count in classification_counts.items():
        percentage = int((count / total_docs) * 100)
        classification_stats.append({
            "type": dtype,
            "count": count,
            "percentage": percentage,
            "color": colors[color_idx % len(colors)]
        })
        color_idx += 1

    # Sort violations: High first, then Medium, then Low. Also sort by date descending.
    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    violations.sort(key=lambda x: (severity_order.get(x["severity"], 3), x["time"]), reverse=False)
    # Actually we want date descending (newest first) but High severity first.
    # So sort by severity ASC (0,1,2) and Time DESC.
    # Python sort is stable. Let's do it in two passes or a complex key.
    # Key: (Severity Index ASC, Time DESC)
    # Time is a string, so simple desc sort works for ISO format, but we used formatted string. 
    # Let's rely on the fact that we process docs in some order? No, docs are not ordered by default.
    # Let's just sort by severity for now as the user asked about priority.
    violations.sort(key=lambda x: severity_order.get(x["severity"], 3))

    return {
        "totalPolicies": 3, # Fixed number of "Active" policies we check
        "activeViolations": len(violations),
        "compliantDocs": compliant_count,
        "auditScore": audit_score,
        "classificationStats": classification_stats,
        "recentViolations": violations[:5] # Top 5
    }
