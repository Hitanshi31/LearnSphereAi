# LearnSphere AI 🎯

> **An AI learning companion that doesn't just answer questions — it models what you actually understand, catches the misconceptions you don't know you have, and helps you repair them.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=next.js)](https://nextjs.org/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-blue)](https://www.trychroma.com/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?logo=google)](https://deepmind.google/technologies/gemini/)
[![HuggingFace](https://img.shields.io/badge/AI%20Fallback-HuggingFace%20Serverless-FFD21E?logo=huggingface)](https://huggingface.co/)
[![Built for](https://img.shields.io/badge/Built%20for-Prometheus%20July%20AI%20Challenge%202026-purple)](#)

[Demo Video](https://youtu.be/h92oy3D9tgg) · [Report a Bug](../../issues) · [Request a Feature](../../issues)

---

## Overview

Most "AI tutors" are glorified search engines: you ask a question, they paste back a summary of the source text. But that's not how learning actually breaks down. Students rarely fail because they lack access to information — they fail because they hold a **confident, wrong mental model** of a concept and don't know it.

**LearnSphere AI** turns any PDF or YouTube video into an adaptive, metacognitive study environment. It tracks not just *whether* you got a question right, but *how sure you were and why you were wrong* — then walks you through repairing the misconception, not just re-reading the answer.

<p align="center">
  <em>📸 Add a screenshot or GIF of the dashboard / concept map here</em>
</p>

---

## Table of Contents

- [Why It's Different](#why-its-different)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Challenges We Solved](#challenges-we-solved)
- [Demo](#demo)
- [License](#license)

---

## Why It's Different

| Traditional AI study tool | LearnSphere AI |
|---|---|
| Answers questions from the text | Diagnoses **why** a wrong answer felt right |
| Tracks correctness only | Tracks correctness **and** confidence calibration |
| One-size-fits-all explanations | 6 persona-based reframings (Beginner, Visual, Programmer, Researcher, Story, Interview) |
| Static summaries | Interactive, clickable concept maps |
| Fails when the API is down | 3-tier LLM fallback — never hard-fails |

---

## Features

### 📚 Dual Ingestion
Upload a PDF (up to 20MB) or paste a YouTube link. Text and auto-captions are chunked and embedded into ChromaDB using `BAAI/bge-small-en-v1.5`, with pre-seeded demo materials (Quantum Mechanics, Neural Networks, Cellular Respiration) for instant testing.

### 🧠 Cognitive Misconception Detector
During quizzes, you rate your **confidence** (1–5) alongside your answer. LearnSphere calculates confidence-alignment — are you overconfident, underconfident, or well-calibrated? — and on a miss, generates a **Common Intuition vs. Scientific Reality** breakdown explaining *why* the wrong answer felt right.

### 🔧 Mental Model Repair
A 1-click guided exercise to fix the misconception, with live persistence and a green **✓ REPAIRED** badge on your learner profile once verified.

### 🗺️ Visual Concept Architecture Maps
Interactive Mermaid.js flowcharts of the domain's concepts, generated directly from the source material, with clickable node drill-down for instant re-explanation.

### 🎭 6-Persona Reframing
Any concept can be re-explained as Beginner, Visual, Programmer, Researcher, Story, or Interview-style — matching the explanation to how *you* think.

### 🎧 Audio & Voice
TTS narration (0.8x–1.5x speed) for summaries and repairs, plus voice dictation for hands-free Q&A.

### ⚡ Resilient by Design
- **LLM fallback**: Gemini (`2.5-flash` → `1.5-flash` → `2.0-flash-exp`) → Hugging Face (`Qwen2.5-72B-Instruct`, `Llama-3-8B-Instruct`) → document-grounded rule-based engine
- **Embedding fallback**: deterministic 384-dim hashing embedder if `sentence-transformers` is unavailable
- **Networking fallback**: auto port failover (8001 → 8000)

The app is built to survive real-world flakiness, not just demo conditions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 15 App Router                      │
│  (Learning Dashboard · Recharts Analytics · Mermaid Maps)   │
└──────────────────────────────┬──────────────────────────────┘
                                │ REST API (auto port detect 8001/8000)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Async Server                    │
│        Document Ingestion · Attempt Scoring · Router         │
└───────┬──────────────────────┬───────────────────────┬──────┘
        │                      │                       │
        ▼                      ▼                       ▼
┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│   PyMuPDF &       │  │     ChromaDB      │  │  Gemini 2.5 &    │
│ YouTube Transcript│  │  (BGE Embeddings) │  │ HuggingFace LLMs │
│      API          │  │  + Hash Fallback  │  │  + Rule Engine   │
└──────────────────┘  └───────────────────┘  └──────────────────┘
```

**Core data models** tie the whole flow together: `DocumentDetail`, `ChunkPreview`, `QuizQuestion`, `AttemptRecord`, `MisconceptionInsight`, `LearningProfile`, `ConceptNode`.

---

## Tech Stack

**Frontend**
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS + custom design tokens
- Recharts (mastery radar / confidence charts)
- Mermaid.js (interactive concept maps)

**Backend**
- FastAPI (async), Python 3.11+, Uvicorn
- PyMuPDF (`fitz`) for PDF extraction
- `youtube-transcript-api` + YouTube oEmbed for video transcripts
- ChromaDB (persistent vector store)
- `sentence-transformers` (`BAAI/bge-small-en-v1.5`, 384-dim)

**AI / LLM**
- Google Gemini (primary): `gemini-2.5-flash` → `gemini-1.5-flash` → `gemini-2.0-flash-exp`
- Hugging Face Serverless Inference (secondary): `Qwen2.5-72B-Instruct`, `Llama-3-8B-Instruct`
- Rule-based / regex NLP engine (tertiary, offline-safe fallback)

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- A [Gemini API key](https://ai.google.dev/) (optional — app runs on fallback engines without one)

### 1. Clone the repo
```bash
git clone https://github.com/Hitanshi31/LearnSphereAi.git
cd LearnSphereAi
```

### 2. Backend setup
```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:
```env
LEARN_SPHERE_GEMINI_API_KEY=your_gemini_api_key_here
LEARN_SPHERE_GEMINI_MODEL=gemini-2.5-flash
```

Start the API server:
```bash
python -m uvicorn app.main:app --reload --port 8001
```

### 3. Frontend setup
From the project root:
```bash
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### Docker (alternative)
```bash
docker build -t learnsphere-ai .
docker run -p 3000:3000 -p 8001:8001 learnsphere-ai
```

---

## Usage

1. **Upload material** — drop in a PDF or paste a YouTube link, or start with a pre-seeded demo topic.
2. **Explore the concept map** — click any node to get an instant explanation or switch persona.
3. **Take a quiz** — answer each question and rate your confidence (1–5) before submitting.
4. **Review misconceptions** — on a miss, read the Common Intuition vs. Scientific Reality breakdown.
5. **Repair your mental model** — complete the guided 1-click exercise to earn the ✓ REPAIRED badge.
6. **Track mastery** — check your learning profile for calibration and progress over time.

---

## Project Structure

```
LearnSphereAi/
├── app/            # Next.js App Router pages & routes
├── backend/         # FastAPI application, ingestion, scoring, LLM pipeline
├── components/       # React UI components
├── data/             # Pre-seeded demo materials
├── lib/               # Shared utilities / client helpers
├── DEMO_SCRIPT.md    # 2-minute demo video script
├── Dockerfile
└── package.json
```

---

## Testing

Backend endpoint & misconception-repair verification:
```bash
python scratch/verify_summary_and_map.py
```

Frontend type checking:
```bash
npx tsc --noEmit
```

---

## Roadmap

- [ ] Spaced-repetition scheduling driven by mastery scores and misconception history
- [ ] Multi-document synthesis — concept maps and quizzes spanning several sources
- [ ] Collaborative / classroom mode with aggregate misconception analytics for instructors
- [ ] Mobile-optimized, audio-first review mode

---

## Challenges We Solved

- **Mastery scoring that means something** — correctness alone doesn't capture understanding, so mastery combines accuracy and confidence-alignment, penalizing overconfident wrong answers more than honest uncertainty.
- **LLM reliability under real-world conditions** — the 3-tier fallback chain (Gemini → Hugging Face → rule-based) guarantees the app never hard-fails on a quiz or summary request, even offline.
- **Reliable Mermaid generation** — getting an LLM to output valid `graph TD` syntax (not just diagram-shaped prose) required careful prompt constraints and pre-render validation.
- **Embedding availability** — `sentence-transformers` downloads can stall in constrained environments, so a deterministic 384-dim hashing embedder keeps vector search functional regardless.

---

## Demo

📹 **Video walkthrough:** [youtu.be/h92oy3D9tgg](https://youtu.be/h92oy3D9tgg)

Built for the **Prometheus July AI Challenge 2026**.

---

## License

Developed for the Prometheus July AI Challenge 2026. See [LICENSE](./LICENSE) for details, or add an MIT license if you intend for others to reuse the code.

---

<p align="center">Made with 🧠 by <a href="https://github.com/Hitanshi31">Hitanshi</a></p>
