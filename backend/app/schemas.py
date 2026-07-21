from datetime import datetime
from enum import StrEnum
from pydantic import BaseModel, Field


class DocumentStatus(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ChunkPreview(BaseModel):
    id: str
    page_number: int
    text: str
    word_count: int


class DocumentSummary(BaseModel):
    id: str
    filename: str
    status: DocumentStatus
    page_count: int = 0
    chunk_count: int = 0
    extracted_characters: int = 0
    created_at: datetime
    error: str | None = None


class DocumentDetail(DocumentSummary):
    chunks: list[ChunkPreview] = Field(default_factory=list)


class Citation(BaseModel):
    chunk_id: str
    page_number: int
    excerpt: str


class ChatRequest(BaseModel):
    document_id: str
    question: str = Field(min_length=2, max_length=1000)


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)


class KeyConcept(BaseModel):
    term: str
    definition: str


class StudyNotesResponse(BaseModel):
    document_id: str
    summary: str = ""
    notes: str
    key_concepts: list[KeyConcept] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)


class QuizQuestion(BaseModel):
    id: str = ""
    question: str
    choices: list[str]
    answer_index: int
    explanation: str
    citations: list[Citation] = Field(default_factory=list)


class QuizResponse(BaseModel):
    document_id: str
    questions: list[QuizQuestion]


class AttemptRequest(BaseModel):
    learner_id: str = Field(default="alex", min_length=1, max_length=80)
    topic: str = Field(min_length=2, max_length=120)
    question: str = Field(min_length=2, max_length=1000)
    student_answer: str = Field(min_length=1, max_length=2000)
    correct_answer: str = Field(min_length=1, max_length=2000)
    confidence: int = Field(ge=1, le=5)
    is_correct: bool


class MisconceptionInsight(BaseModel):
    id: str = ""
    topic: str
    label: str
    why: str
    common_intuition: str
    scientific_reality: str
    correction: str
    verification_check: str
    verification_options: list[str] = Field(default_factory=list)
    verification_correct_index: int = 0
    created_at: str = ""


class AttemptRecord(BaseModel):
    id: str
    topic: str
    question: str
    student_answer: str
    correct_answer: str
    confidence: int
    is_correct: bool
    timestamp: str


class TopicMastery(BaseModel):
    topic: str
    mastery: int
    attempts: int
    correct: int
    confidence: float
    misconception_count: int


class LearningProfile(BaseModel):
    learner_id: str
    overall_mastery: int
    accuracy_rate: int = 0
    confidence_alignment: int = 0
    total_attempts: int = 0
    topics: list[TopicMastery] = Field(default_factory=list)
    recent_misconceptions: list[MisconceptionInsight] = Field(default_factory=list)
    attempt_history: list[AttemptRecord] = Field(default_factory=list)


class AttemptResponse(BaseModel):
    profile: LearningProfile
    misconception: MisconceptionInsight | None = None
