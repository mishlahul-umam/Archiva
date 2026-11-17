import asyncio
import os
from dotenv import load_dotenv
from services.ai_service import extract_metadata

# Load env to get key
load_dotenv()

async def debug():
    print("--- Debugging AI Service ---")
    key = os.getenv("GEMINI_API_KEY")
    print(f"API Key found: {bool(key)}")
    if key:
        print(f"Key start: {key[:5]}...")
    
    text = """
    INVOICE #1023
    Date: 2023-10-25
    To: John Doe
    Amount: $500.00
    Service: Web Development
    Please pay by 2023-11-01.
    Contact: billing@example.com
    """
    
    print("\nCalling extract_metadata...")
    try:
        result = await extract_metadata(text)
        print("\nResult:")
        print(result)
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(debug())