import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .repositories import DocumentRepository
from .schemas import (
    AttemptRecord,
    AttemptRequest,
    AttemptResponse,
    ChatRequest,
    ChatResponse,
    ChunkPreview,
    DocumentDetail,
    DocumentSummary,
    KeyConcept,
    LearningProfile,
    MisconceptionInsight,
    QuizResponse,
    StudyNotesResponse,
    TopicMastery,
)
from .services.document_processor import PdfProcessor
from .services.grounded_learning import GeminiClient, GroundedStudyService, SourceChunk, VectorIndex
from .services.learning_profile import LearningProfileStore, MisconceptionDetector

settings = get_settings()
repository = DocumentRepository()
processor = PdfProcessor()
gemini_client = GeminiClient(settings)
study_service = GroundedStudyService(VectorIndex(settings), gemini_client)
profile_store = LearningProfileStore()
misconception_detector = MisconceptionDetector(gemini_client)


# ------------------------------------------------------------------ #
# Startup: pre-warm the embedding model in background so first upload
# doesn't stall waiting for the BGE model to download & load.
# ------------------------------------------------------------------ #
@asynccontextmanager
async def lifespan(app: FastAPI):
    def _warm_model():
        try:
            print("[LearnSphere] Pre-loading BGE embedding model...")
            study_service.vector_index._embed(["LearnSphere AI warmup"])
            print("[LearnSphere] Embedding model ready.")
        except Exception as exc:
            print(f"[LearnSphere] Model warmup notice (non-fatal): {exc}")

    threading.Thread(target=_warm_model, daemon=True).start()
    yield


app = FastAPI(title="LearnSphere AI", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": "LearnSphere AI"}


@app.get("/api/v1/documents", response_model=list[DocumentSummary])
def list_documents() -> list[DocumentSummary]:
    return repository.list()


@app.get("/api/v1/documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str) -> DocumentDetail:
    document = repository.get(document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def require_document(document_id: str) -> DocumentDetail:
    document = repository.get(document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document.status.value != "ready":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document is not ready for study tools")
    return document


def serialize_profile(learner_id: str) -> LearningProfile:
    learner = profile_store.get(learner_id)
    topics = [
        TopicMastery(
            topic=topic,
            mastery=state.mastery,
            attempts=state.attempts,
            correct=state.correct,
            confidence=round(state.confidence_total / state.attempts, 1) if state.attempts else 0.0,
            misconception_count=state.misconception_count,
        )
        for topic, state in learner.topics.items()
    ]

    total_attempts = sum(t.attempts for t in topics)
    total_correct = sum(t.correct for t in topics)
    overall_accuracy = round((total_correct / total_attempts) * 100) if total_attempts else 0
    overall_mastery = round(sum(topic.mastery for topic in topics) / len(topics)) if topics else 0

    confidence_alignment_avg = max(0, round(
        sum(max(0, 100 - abs(int(t.confidence * 20) - round((t.correct / t.attempts) * 100))) for t in topics if t.attempts) / len(topics)
    )) if topics else 0

    return LearningProfile(
        learner_id=learner_id,
        overall_mastery=overall_mastery,
        accuracy_rate=overall_accuracy,
        confidence_alignment=confidence_alignment_avg,
        total_attempts=total_attempts,
        topics=topics,
        recent_misconceptions=[MisconceptionInsight(**item) for item in learner.recent_misconceptions],
        attempt_history=[AttemptRecord(**item) for item in learner.attempt_history],
    )


@app.get("/api/v1/learners/{learner_id}/profile", response_model=LearningProfile)
def get_profile(learner_id: str) -> LearningProfile:
    return serialize_profile(learner_id)


@app.post("/api/v1/learning/attempts", response_model=AttemptResponse)
def record_attempt(attempt: AttemptRequest) -> AttemptResponse:
    insight = misconception_detector.detect(
        attempt.topic, attempt.question, attempt.student_answer, attempt.correct_answer, attempt.is_correct
    )
    profile_store.record(
        attempt.learner_id,
        attempt.topic,
        attempt.question,
        attempt.student_answer,
        attempt.correct_answer,
        attempt.is_correct,
        attempt.confidence,
        insight,
    )
    return AttemptResponse(
        profile=serialize_profile(attempt.learner_id),
        misconception=MisconceptionInsight(**insight) if insight else None,
    )


@app.post("/api/v1/study/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    require_document(request.document_id)
    try:
        answer, citations = study_service.answer(request.document_id, request.question)
        return ChatResponse(answer=answer, citations=citations)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@app.post("/api/v1/documents/{document_id}/notes", response_model=StudyNotesResponse)
def generate_notes(document_id: str) -> StudyNotesResponse:
    require_document(document_id)
    try:
        summary, notes, key_concepts, citations = study_service.notes(document_id)
        return StudyNotesResponse(
            document_id=document_id,
            summary=summary,
            notes=notes,
            key_concepts=key_concepts,
            citations=citations,
        )
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@app.post("/api/v1/documents/{document_id}/quiz", response_model=QuizResponse)
def generate_quiz(document_id: str) -> QuizResponse:
    require_document(document_id)
    try:
        return QuizResponse(document_id=document_id, questions=study_service.quiz(document_id))
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


# ------------------------------------------------------------------ #
# Background PDF processing (runs in FastAPI thread pool after
# the upload endpoint has already returned to the client).
# ------------------------------------------------------------------ #
def _process_document_task(document_id: str, saved_path: Path) -> None:
    """Extract text, chunk, and index into ChromaDB. Runs off the request thread."""
    try:
        print(f"[LearnSphere] Processing {saved_path.name}...")
        processed = processor.process(saved_path)
        if not processed.chunks:
            raise ValueError("No selectable text found. Try an OCR-enabled PDF.")
        chunks = [
            ChunkPreview(
                id=f"{document_id}:{index}",
                page_number=chunk.page_number,
                text=chunk.text,
                word_count=len(chunk.text.split()),
            )
            for index, chunk in enumerate(processed.chunks, start=1)
        ]
        repository.mark_ready(document_id, processed.page_count, processed.extracted_characters, chunks)
        study_service.vector_index.index(
            document_id,
            [SourceChunk(id=chunk.id, page_number=chunk.page_number, text=chunk.text) for chunk in chunks],
        )
        print(f"[LearnSphere] Document {document_id} ready — {len(chunks)} chunks indexed.")
    except Exception as error:
        print(f"[LearnSphere] Document {document_id} failed: {error}")
        repository.mark_failed(document_id, str(error))


@app.post("/api/v1/documents", response_model=DocumentDetail, status_code=status.HTTP_201_CREATED)
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> DocumentDetail:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Please upload a PDF file")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The uploaded PDF is empty")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="PDF exceeds the upload limit")

    # Create the document record and save the file immediately
    document = repository.create(file.filename, datetime.now(timezone.utc))
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    saved_path = settings.upload_dir / f"{uuid4()}.pdf"
    saved_path.write_bytes(content)
    repository.attach_file(document.id, saved_path)

    # Kick off heavy processing in the background — return immediately to client
    background_tasks.add_task(_process_document_task, document.id, saved_path)

    return document  # Status is "processing" — client should poll GET /api/v1/documents/{id}
