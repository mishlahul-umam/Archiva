import asyncio
import asyncpg
from sqlalchemy.engine import make_url
from database import DATABASE_URL

async def create_database():
    url = make_url(DATABASE_URL)
    db_name = url.database

    # Connect to the default 'postgres' database to create the new one
    sys_conn = await asyncpg.connect(
        user=url.username,
        password=url.password,
        host=url.host,
        port=url.port,
        database='postgres',
    )
    
    try:
        # Check if database exists
        exists = await sys_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )

        if not exists:
            print(f"Creating database '{db_name}'...")
            quoted = db_name.replace('"', '""')
            await sys_conn.execute(f'CREATE DATABASE "{quoted}"')
            print(f"Database '{db_name}' created successfully.")
        else:
            print(f"Database '{db_name}' already exists.")
            
    except Exception as e:
        print(f"Error creating database: {e}")
    finally:
        await sys_conn.close()

if __name__ == "__main__":
    asyncio.run(create_database())
