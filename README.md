# LearnSphere AI

> An AI that doesn't just teach — it understands how you learn.

## Milestone 1 — Learning-profile experience

This first milestone establishes the product's differentiator before any infrastructure work: a student can see a living learning profile, topic mastery, learning activity, a recommendation grounded in a detected misconception, and a focused misconception-review flow.

### Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

### Run the ingestion API

```powershell
python -m pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

Copy `.env.local.example` to `.env.local` only if the API is hosted somewhere other than `http://localhost:8000`.

## Delivery roadmap

1. **Product shell and demo narrative** — complete in this milestone.
2. **Material ingestion** — complete: FastAPI upload endpoint, PyMuPDF extraction, chunking and document status.
3. **Grounded study tools** — complete: BGE embeddings, Chroma retrieval, cited RAG chat, notes and quiz generation.
4. **Learning intelligence** — complete in the MVP: attempt recording, mastery updates, confidence calibration and misconception classification. PostgreSQL persistence is the next production hardening step.
5. **Hackathon finish** — seeded demo journey, analytics polish, error states, deployment and a two-minute demo script.

## Architecture boundary

The interface uses typed, isolated sample data in `lib/learning-data.ts`. Milestones 2–4 should replace that adapter with API clients without coupling UI components to FastAPI, ChromaDB, or Gemini directly.
