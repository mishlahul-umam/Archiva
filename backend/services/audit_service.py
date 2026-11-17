from sqlalchemy.ext.asyncio import AsyncSession
from models import AuditLog

async def log_action(db: AsyncSession, user_id: int, action: str, details: str = None):
    try:
        new_log = AuditLog(
            user_id=user_id,
            action=action,
            details=details
        )
        db.add(new_log)
        # We don't commit here usually if part of larger transaction, 
        # but for logging it's often safer to ensure it's committed or let the caller handle it.
        # Assuming caller handles commit if they pass the session.
        # If we want independent logging, we'd need a separate session context.
        # For simplicity, we just add it to the session.
    except Exception as e:
        print(f"Failed to create audit log: {e}")
