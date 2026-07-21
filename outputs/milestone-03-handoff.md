# LearnSphere AI — Milestone 3 handoff

## Why this milestone exists

The product cannot become another chatbot. Its study assistance must be grounded in the learner’s own material, and it must show where each answer came from. This milestone creates that trust boundary.

## Completed

- BAAI `bge-small-en-v1.5` embedding adapter with normalized vectors
- Persistent Chroma collection keyed by document and chunk/page provenance
- Source-grounded chat endpoint: `POST /api/v1/study/chat`
- Citation-bearing study notes endpoint: `POST /api/v1/documents/{id}/notes`
- Reasoning-focused diagnostic quiz endpoint: `POST /api/v1/documents/{id}/quiz`
- Gemini REST client with a conservative system instruction: use supplied sources only
- Dashboard chat wired to the most recently uploaded document, with visible page citations

## Configuration

Set these server variables before exercising generation:

```text
LEARN_SPHERE_GEMINI_API_KEY=...
LEARN_SPHERE_GEMINI_MODEL=gemini-2.5-flash
```

Then install the complete backend requirements. The first indexed document downloads the BGE model from Hugging Face; it is intentionally lazy so starting the API remains fast.

## Validation passed

- Python source compilation
- All three grounded-study routes registered successfully
- Unknown-document chat returns `404` rather than attempting generation

## Next milestone

Persist quiz attempts and turn outcomes into the Learning Profile: topic mastery, confidence calibration, and misconception classification. That is the moment LearnSphere starts adapting, rather than merely answering.
