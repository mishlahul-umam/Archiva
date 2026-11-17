import asyncio
from sqlalchemy import text
from database import AsyncSessionLocal

async def migrate():
    async with AsyncSessionLocal() as session:
        # 1. Add ai_metadata column to documents
        try:
            await session.execute(text("ALTER TABLE documents ADD COLUMN ai_metadata JSONB"))
            await session.commit()
            print("Added ai_metadata column")
        except Exception as e:
            print(f"ai_metadata column might already exist: {e}")
            await session.rollback()

        # 2. Add version column to documents
        try:
            await session.execute(text("ALTER TABLE documents ADD COLUMN version INTEGER DEFAULT 1"))
            await session.commit()
            print("Added version column")
        except Exception as e:
            print(f"version column might already exist: {e}")
            await session.rollback()

        # 3. Add updated_at column to documents
        try:
            await session.execute(text("ALTER TABLE documents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE"))
            await session.commit()
            print("Added updated_at column")
        except Exception as e:
            print(f"updated_at column might already exist: {e}")
            await session.rollback()

        # 4. Create document_relationships table
        try:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS document_relationships (
                    id SERIAL PRIMARY KEY,
                    source_id INTEGER NOT NULL REFERENCES documents(id),
                    target_id INTEGER NOT NULL REFERENCES documents(id),
                    relationship_type VARCHAR NOT NULL
                )
            """))
            await session.commit()
            print("Created document_relationships table")
        except Exception as e:
            print(f"Failed to create document_relationships table: {e}")
            await session.rollback()

        # 5. Create audit_logs table
        try:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    action VARCHAR NOT NULL,
                    details VARCHAR,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            await session.commit()
            print("Created audit_logs table")
        except Exception as e:
            print(f"Failed to create audit_logs table: {e}")
            await session.rollback()

        # Previous migrations (optional to keep, but good for idempotency)
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN first_name VARCHAR"))
            await session.commit()
        except:
            await session.rollback()

        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN last_name VARCHAR"))
            await session.commit()
        except:
            await session.rollback()

        # 6. Create cabinets table
        try:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS cabinets (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    parent_id INTEGER REFERENCES cabinets(id),
                    owner_id INTEGER REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            await session.commit()
            print("Created cabinets table")
        except Exception as e:
            print(f"Failed to create cabinets table: {e}")
            await session.rollback()

        # 7. Create cabinet_documents table
        try:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS cabinet_documents (
                    cabinet_id INTEGER REFERENCES cabinets(id),
                    document_id INTEGER REFERENCES documents(id),
                    PRIMARY KEY (cabinet_id, document_id)
                )
            """))
            await session.commit()
            print("Created cabinet_documents table")
        except Exception as e:
            print(f"Failed to create cabinet_documents table: {e}")
            await session.rollback()
            
        # 8. Migrate to One-to-Many (documents -> cabinets)
        try:
            # Add cabinet_id column
            await session.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS cabinet_id INTEGER REFERENCES cabinets(id)"))
            await session.commit()
            print("Added cabinet_id column to documents")
            
            # Migrate data from cabinet_documents (take first if multiple, though unlikely in new usage)
            # This is best effort for existing data
            try:
                await session.execute(text("""
                    UPDATE documents 
                    SET cabinet_id = subquery.cabinet_id
                    FROM (SELECT document_id, MIN(cabinet_id) as cabinet_id FROM cabinet_documents GROUP BY document_id) AS subquery
                    WHERE documents.id = subquery.document_id
                """))
                await session.commit()
                print("Migrated existing cabinet relationships")
            except Exception as e:
                 print(f"Data migration skipped (maybe table doesn't exist): {e}")

            # Drop old table
            await session.execute(text("DROP TABLE IF EXISTS cabinet_documents"))
            await session.commit()
            print("Dropped cabinet_documents table")

        except Exception as e:
            print(f"Migration step 8 failed: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
