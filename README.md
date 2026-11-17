# Archiva

**Enterprise document management system (EDMS)** built with FastAPI, PostgreSQL and React.

Archiva turns uploaded files into searchable, classified records. It extracts text with OCR, classifies each document, generates a summary, entities and tags, and routes documents through an approval workflow with a full audit trail.

## Features

| Area | What it does |
|---|---|
| Upload and OCR | Upload PDFs and images. Text is extracted in the background with PyMuPDF (PDF) and Tesseract (JPG, PNG, BMP, TIFF). |
| Automatic analysis | A local, rule-based engine classifies each document (Invoice, Contract, Resume, Report, Letter), writes an extractive summary, and extracts entities (emails, dates, amounts, names) and tags. No external AI service is called. |
| Search | Case-insensitive search across titles, file names and extracted text. |
| Cabinets | Nested folders (a cabinet tree) to organise documents. |
| Approval workflow | Documents move through draft, pending, approved and rejected, with a pending queue for reviewers. |
| Audit trail | Logins, user changes, uploads, downloads, deletions and workflow actions are logged. The audit log is visible to SuperAdmins only. |
| Compliance dashboard | Policy checks for sensitive data (PII keywords), missing classification and missing metadata. |
| Users and groups | User management with five roles: SuperAdmin, Admin, DocumentManager, Reviewer and Viewer. |
| Dashboard | Totals, pending approvals, documents processed today and storage usage at a glance. |

## Tech stack

| Layer | Technologies |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy 2.0 (async) + asyncpg, Alembic, Pydantic v2, JWT (python-jose), passlib/bcrypt |
| Document processing | PyMuPDF, pytesseract + Pillow |
| Database | PostgreSQL (JSONB for AI metadata) |
| Frontend | React 19, TypeScript, Vite 7, React Router 7, Tailwind CSS v4, axios, lucide-react |

## Architecture

```
┌──────────────┐   REST + JWT bearer   ┌───────────────────┐        ┌────────────┐
│ React (Vite) │ ────────────────────► │ FastAPI (8 routers)│ ─────► │ PostgreSQL │
│  :5173       │ ◄──────────────────── │  :8000             │ ◄───── │            │
└──────────────┘                       └─────────┬─────────┘        └────────────┘
                                                 │ background task
                                                 ▼
                                  OCR (PyMuPDF / Tesseract)
                                                 │
                                                 ▼
                          Classification, summary, entities, tags
```

Upload flow: the file is stored in `backend/uploads/` and a record is created. A background task then runs OCR and the analysis engine, and saves the results (`ocr_content` and `ai_metadata`) to the document row.

## Project structure

```
Archiva/
├── backend/
│   ├── main.py             # FastAPI app, CORS, router registration
│   ├── models.py           # SQLAlchemy models
│   ├── schemas*.py         # Pydantic schemas
│   ├── auth.py             # Password hashing and JWT helpers
│   ├── database.py         # Async engine and session (reads .env)
│   ├── routers/            # auth, documents, groups, dashboard, audit,
│   │                       # compliance, workflow, cabinets
│   ├── services/           # AI analysis engine, audit logging
│   ├── alembic/            # Database migrations
│   ├── migration.py        # Additional raw-SQL migrations
│   └── create_*.py         # Database and admin bootstrap scripts
└── frontend/
    └── src/
        ├── pages/          # Dashboard, Documents, Search, Cabinets, Workflow,
        │                   # Audit, Compliance, Users, Permissions, Settings, Profile
        ├── components/     # Layout, Sidebar, DocumentActions, Logo
        └── context/        # Auth context
```

## Getting started

### Prerequisites

- Python 3.8 or newer (developed on 3.8.6)
- Node.js 20.19+ or 22.12+ (required by Vite 7)
- PostgreSQL
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed and available on your `PATH` (needed for image OCR)

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit .env with your own values
python create_db.py         # creates the database named in DATABASE_URL
alembic upgrade head        # base tables
python migration.py         # remaining tables and columns (cabinets, relationships, AI metadata)
python create_default_admin.py   # or: python create_superuser.py (interactive)

uvicorn main:app --reload
```

The API runs at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

`create_default_admin.py` creates a `SuperAdmin` user named `admin` with the password `admin`. This is for local development only: change the password right after the first login, or use `create_superuser.py` to choose your own credentials.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

> The frontend currently calls the API at `http://localhost:8000`, and the backend only allows CORS from `http://localhost:5173`. Keep both on their default ports for now.

## Configuration

All backend settings live in `backend/.env` (see [`backend/.env.example`](backend/.env.example)).

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://user:password@host:port/dbname`) |
| `SECRET_KEY` | Secret used to sign JWT tokens. Use a long random value. |
| `ALGORITHM` | JWT signing algorithm (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes (`30`) |
| `GEMINI_API_KEY` | Optional. Only used by the experimental scripts `debug_ai.py`, `list_models.py` and `test_ai.py`. |

## Roadmap

Archiva is an actively evolving portfolio project. Planned improvements:

- Stricter role-based access control and workflow state checks
- Authenticated file downloads instead of public static serving
- A central API client with an environment-based API URL, and shared UI components
- Reproducible setup: complete `requirements.txt`, Docker Compose, CI
- Automated tests for the backend and frontend
- Better OCR (resolution and language options) and richer document analysis

## License

No license has been specified yet. Note that PyMuPDF is distributed under AGPL-3.0, which matters if you plan to reuse this project commercially.
