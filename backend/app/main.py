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
    AdaptiveQuizRequest,
    AttemptRecord,
    AttemptRequest,
    AttemptResponse,
    ChatRequest,
    ChatResponse,
    ChunkPreview,
    DocumentDetail,
    DocumentSummary,
    ExplainRequest,
    ExplainResponse,
    KeyConcept,
    LearningProfile,
    MisconceptionInsight,
    QuizResponse,
    StudyNotesResponse,
    TopicMastery,
    VisualExplainerResponse,
    ConceptNode,
    YoutubeIngestRequest,
    YoutubeIngestResponse,
)
from .services.document_processor import PdfProcessor
from .services.grounded_learning import GeminiClient, GroundedStudyService, SourceChunk, VectorIndex
from .services.learning_profile import LearningProfileStore, MisconceptionDetector
from .services.youtube_processor import YouTubeProcessor

settings = get_settings()
repository = DocumentRepository()
processor = PdfProcessor()
youtube_processor = YouTubeProcessor()
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


# ------------------------------------------------------------------ #
# YouTube ingestion
# ------------------------------------------------------------------ #

@app.post("/api/v1/youtube", response_model=YoutubeIngestResponse, status_code=status.HTTP_201_CREATED)
def ingest_youtube(request: YoutubeIngestRequest) -> YoutubeIngestResponse:
    """Extract transcript from a YouTube URL, chunk it, and index it into ChromaDB."""
    document_id = f"yt-{str(uuid4())[:8]}"
    try:
        result = youtube_processor.process(request.url, document_id)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    try:
        study_service.vector_index.index(document_id, result.chunks)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Indexing failed: {error}") from error

    # Register document in repository so it appears in document list and study tools work seamlessly
    chunks_preview = [
        ChunkPreview(
            id=chunk.id,
            page_number=chunk.page_number,
            text=chunk.text,
            word_count=len(chunk.text.split()),
        )
        for chunk in result.chunks
    ]
    repository.create(result.title, datetime.now(timezone.utc), document_id=document_id)
    repository.mark_ready(
        document_id=document_id,
        page_count=1,
        extracted_characters=sum(len(c.text) for c in result.chunks),
        chunks=chunks_preview,
    )

    return YoutubeIngestResponse(
        document_id=document_id,
        video_id=result.video_id,
        title=result.title,
        chunk_count=len(result.chunks),
        total_words=result.total_words,
        language=result.language,
        status="ready",
    )


# ------------------------------------------------------------------ #
# Visual explainer
# ------------------------------------------------------------------ #

@app.post("/api/v1/documents/{document_id}/visual", response_model=VisualExplainerResponse)
def generate_visual(document_id: str) -> VisualExplainerResponse:
    """Generate a Mermaid concept map and concept node list for a document."""
    require_document(document_id)
    try:
        data = study_service.visual_explainer(document_id)
        return VisualExplainerResponse(
            document_id=document_id,
            title=data.get("title", "Concept Map"),
            mermaid_code=data.get("mermaid_code", ""),
            concept_nodes=[
                ConceptNode(
                    id=node.get("id", f"node-{i}"),
                    label=node.get("label", ""),
                    summary=node.get("summary", ""),
                    type=node.get("type", "definition"),
                )
                for i, node in enumerate(data.get("concept_nodes", []))
            ],
        )
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


# Also support visual for YouTube documents (no status check needed)
@app.post("/api/v1/youtube/{document_id}/visual", response_model=VisualExplainerResponse)
def generate_visual_youtube(document_id: str) -> VisualExplainerResponse:
    """Generate a Mermaid concept map for a YouTube-ingested document."""
    try:
        data = study_service.visual_explainer(document_id)
        return VisualExplainerResponse(
            document_id=document_id,
            title=data.get("title", "Concept Map"),
            mermaid_code=data.get("mermaid_code", ""),
            concept_nodes=[
                ConceptNode(
                    id=node.get("id", f"node-{i}"),
                    label=node.get("label", ""),
                    summary=node.get("summary", ""),
                    type=node.get("type", "definition"),
                )
                for i, node in enumerate(data.get("concept_nodes", []))
            ],
        )
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


# ------------------------------------------------------------------ #
# Explain in different styles
# ------------------------------------------------------------------ #

@app.post("/api/v1/documents/{document_id}/explain", response_model=ExplainResponse)
def explain_in_style(document_id: str, request: ExplainRequest) -> ExplainResponse:
    """Re-explain a topic from the document in one of six learning styles."""
    require_document(document_id)
    try:
        content = study_service.explain_in_style(document_id, request.topic, request.style)
        return ExplainResponse(
            document_id=document_id,
            topic=request.topic,
            style=request.style,
            content=content,
        )
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


# Also support explain for YouTube documents
@app.post("/api/v1/youtube/{document_id}/explain", response_model=ExplainResponse)
def explain_in_style_youtube(document_id: str, request: ExplainRequest) -> ExplainResponse:
    """Re-explain a topic from a YouTube document in one of six learning styles."""
    try:
        content = study_service.explain_in_style(document_id, request.topic, request.style)
        return ExplainResponse(
            document_id=document_id,
            topic=request.topic,
            style=request.style,
            content=content,
        )
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


# ------------------------------------------------------------------ #
# Adaptive quiz (profile-aware difficulty weighting)
# ------------------------------------------------------------------ #

@app.post("/api/v1/documents/{document_id}/adaptive-quiz", response_model=QuizResponse)
def adaptive_quiz(document_id: str, request: AdaptiveQuizRequest) -> QuizResponse:
    """Generate a quiz weighted toward the learner's weak topics."""
    require_document(document_id)
    learner = profile_store.get(request.learner_id)
    weak_topics = [
        topic for topic, state in learner.topics.items()
        if state.mastery < 60 and state.attempts >= 1
    ]
    try:
        questions = study_service.adaptive_quiz(document_id, weak_topics)
        return QuizResponse(document_id=document_id, questions=questions)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
