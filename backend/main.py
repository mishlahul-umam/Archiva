from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from routers import auth, documents, groups, dashboard, audit, compliance, workflow, cabinets

app = FastAPI(
    title="Archiva API",
    description="Enterprise Document Management System API",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
if not os.path.exists("uploads"):
    os.makedirs("uploads")

# Mount uploads directory to serve files (Protected in real app, but open for now)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(groups.router)
app.include_router(dashboard.router)
app.include_router(audit.router)
app.include_router(compliance.router)
app.include_router(workflow.router)
app.include_router(cabinets.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Archiva API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
