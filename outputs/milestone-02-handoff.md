# LearnSphere AI — Milestone 2 handoff

## Why this milestone exists

Grounded learning features only work when study material is converted into traceable source content. This slice establishes the reliable path from a student’s PDF to page-aware chunks that later RAG, notes, quizzes, and misconception feedback can cite.

## Completed

- `POST /api/v1/documents`: PDF-only upload with 20 MB guardrail
- PyMuPDF text extraction with page provenance retained through chunking
- Configurable word-window chunker with overlap
- `GET /api/v1/documents` and `GET /api/v1/documents/{id}` status endpoints
- Explicit failures for empty, invalid, and image-only PDFs
- Dashboard upload button wired to the live API with clear processing feedback

## Validation passed

- `GET /health` returns `{ "status": "ok" }`
- Empty document list returns `[]`
- A generated two-page PDF upload returned `201`, `ready`, 2 pages, 2 chunks, and correct page references

## Run locally

```powershell
python -m pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

In a second terminal:

```powershell
npm install
npm run dev
```

## Deliberate limitation

The repository is in-process for this milestone, so a restart clears document metadata. Milestone 4 should move this interface to PostgreSQL, while preserving the current API contract.
