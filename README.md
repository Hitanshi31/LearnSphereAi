# LearnSphere AI 🎯
> **An Intelligent Metacognitive Learning Companion that continuously models student understanding, detects cognitive misconceptions, calibrates confidence, and visualizes knowledge architecture.**

[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python 3.11](https://img.shields.io/badge/Language-Python%203.11+-3776AB?logo=python)](https://www.python.org/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-blue)](https://www.trychroma.com/)
[![Gemini 2.0](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-4285F4?logo=google)](https://deepmind.google/technologies/gemini/)
[![HuggingFace](https://img.shields.io/badge/AI%20Fallback-HuggingFace%20Serverless-FFD21E?logo=huggingface)](https://huggingface.co/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ⚡ 2-Minute Quickstart for Judges & Developers

> 💡 **Instant Evaluation Mode**: You do **NOT** need to upload any PDF files! The app comes pre-loaded with sample materials (*Quantum Mechanics*, *Neural Networks*, *Cellular Respiration*).

### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m venv .venv

# Activate environment (Windows PowerShell: .\.venv\Scripts\Activate.ps1 | Mac/Linux: source .venv/bin/activate)
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
*Backend runs on `http://localhost:8000` (Docs: `http://localhost:8000/docs`)*

### 2. Frontend Setup (Next.js 15)
In a second terminal window (root directory):
```bash
npm install
npm run dev
```
Open 👉 **`http://localhost:3000`** in your browser.

---

## 🌟 What is LearnSphere AI?

Traditional AI study tools act as **passive Q&A search engines**—they answer questions without understanding what the student actually comprehends. **LearnSphere AI** transforms study materials (PDF textbooks & YouTube video transcripts) into an active metacognitive learning environment.

* 🧠 **Metacognitive Modeling**: Evaluates accuracy alongside confidence calibration (detecting overconfidence vs underconfidence).
* 🎯 **Cognitive Misconception Detector**: Diagnoses *Common Intuition vs. Scientific Reality* when a concept is missed.
* 🛠️ **Live Mental Model Repairs**: Allows students to complete 1-click repair exercises with live profile updates (**✓ REPAIRED** status).
* 🗺️ **Visual Knowledge Architecture**: Automatically extracts domain concepts into interactive **Mermaid.js flowcharts**.

---

## ✨ Core Features & AI Intelligence

* 📚 **Dual Ingestion Hub (PDF & YouTube)**: Background PDF text extraction (PyMuPDF) and YouTube video transcript chunking (`youtube-transcript-api`) indexed in **ChromaDB** with `BAAI/bge-small-en-v1.5` embeddings.
* 🗺️ **Visual Concept Architecture Maps**: Valid Mermaid.js flowcharts (`graph TD`) mapping domain concepts and relationship action verbs directly from uploaded materials with 1-click node drill-downs.
* 🎨 **6-Persona Explanation Reframing**: Re-explains any concept across 6 learning styles: **Beginner**, **Visual**, **Programmer**, **Researcher**, **Story**, and **Interview**.
* 🔬 **Knowledge X-Ray Engine**: Generates diagnostic probes to test deep structural understanding rather than surface memorization.
* 🎧 **Audio & Speech Engine**: Built-in Text-to-Speech narration bar (0.8x–1.5x speed) and Speech-to-Text microphone voice Q&A input.
* ⚡ **Multi-LLM Resilience Pipeline**: Primary Google Gemini (`gemini-2.0-flash`) $\rightarrow$ Secondary Hugging Face Inference API (`Qwen-72B`, `Llama-3-8B`) $\rightarrow$ Grounded NLP Engine.

---

## 🏗️ System Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────────┐
   │                  Next.js 15 App Router                      │
   │  (Learning Dashboard, Recharts Analytics, Mermaid Diagrams) │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ REST API (Auto-Port Failover 8000 / 8001)
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                     FastAPI Async Server                    │
   │   (PyMuPDF Ingestion, YouTube Processor, Repositories)      │
   └───────┬──────────────────────┬───────────────────────┬──────┘
           │                      │                       │
           ▼                      ▼                       ▼
 ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐
 │    PyMuPDF &     │   │     ChromaDB      │   │   Multi-LLM      │
 │ YouTube Transcripts│  │  (BGE Embeddings) │   │ (Gemini + HF)    │
 └──────────────────┘   └───────────────────┘   └──────────────────┘
```

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | Reactive SPA UI with auto API failover |
| **Styling** | Vanilla CSS Tokens, Glassmorphism, TailwindCSS | Modern dark-mode aesthetic design tokens |
| **Visualizations** | Mermaid.js, Recharts | Concept map flowcharts & radar mastery charts |
| **Backend** | Python 3.11+, FastAPI, Uvicorn | Async REST server & document processing pipelines |
| **Vector DB & Embeddings** | ChromaDB, `BAAI/bge-small-en-v1.5` | Semantic vector search & document chunk indexing |
| **Primary AI** | Google Gemini (`gemini-2.0-flash`) | Quiz, visual map, and diagnostic synthesis |
| **Fallback AI** | Hugging Face Serverless API (Qwen-72B / Llama-3) | Open-source serverless model fallback |

---

## 🔌 REST API Endpoints & Developer Reference

<details>
<summary><b>Click to expand REST API Reference & Directory Tree</b></summary>

### REST API Endpoints
| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/health` | `GET` | System health check and API status |
| `/api/v1/documents` | `GET` | List all processed & pre-seeded documents |
| `/api/v1/documents` | `POST` | Upload a PDF document for asynchronous processing |
| `/api/v1/documents` | `DELETE` | Reset and delete all documents, profiles, and vector stores |
| `/api/v1/documents/{id}` | `GET` | Get detailed document metadata & chunk previews |
| `/api/v1/documents/{id}/notes` | `POST` | Generate executive summary & key concepts |
| `/api/v1/documents/{id}/visual` | `POST` | Generate Mermaid.js concept architecture map |
| `/api/v1/documents/{id}/explain` | `POST` | Re-explain topic across 6 learning style personas |
| `/api/v1/documents/{id}/adaptive-quiz` | `POST` | Generate diagnostic quiz weighted toward weak topics |
| `/api/v1/youtube` | `POST` | Ingest YouTube video transcript from URL |
| `/api/v1/learners/{id}/profile` | `GET` | Retrieve learner metacognitive profile & misconceptions |
| `/api/v1/learning/attempt` | `POST` | Log quiz attempt, compute confidence alignment & mastery |
| `/api/v1/learning/repair-misconception` | `POST` | Verify and persist mental model misconception repair |

### Directory Tree
```
LearnSphereAi/
├── app/                        # Next.js 15 App Router pages & styling
├── backend/                    # FastAPI python backend
│   ├── app/
│   │   ├── main.py             # FastAPI routes & lifespan model warmup
│   │   ├── repositories.py     # JSON document repository
│   │   └── services/           # AI, vector DB, & profile services
│   └── data/                   # Persistent stored documents & Chroma DB
├── components/                 # React UI components & Mermaid renderer
├── scratch/                    # Verification & database reset scripts
└── README.md                   # Project documentation
```
</details>

---

## 📜 License
This project is open-source under the **MIT License**.
