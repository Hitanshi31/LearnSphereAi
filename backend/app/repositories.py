from pathlib import Path
from threading import Lock
from uuid import uuid4
from .schemas import ChunkPreview, DocumentDetail, DocumentStatus, DocumentSummary


class DocumentRepository:
    """In-process repository with a replaceable interface for PostgreSQL in Milestone 4."""

    def __init__(self) -> None:
        self._documents: dict[str, DocumentDetail] = {}
        self._files: dict[str, Path] = {}
        self._lock = Lock()

    def create(self, filename: str, created_at) -> DocumentDetail:
        document = DocumentDetail(
            id=str(uuid4()), filename=filename, status=DocumentStatus.PROCESSING, created_at=created_at
        )
        with self._lock:
            self._documents[document.id] = document
        return document

    def attach_file(self, document_id: str, path: Path) -> None:
        with self._lock:
            self._files[document_id] = path

    def mark_ready(self, document_id: str, page_count: int, extracted_characters: int, chunks: list[ChunkPreview]) -> DocumentDetail:
        with self._lock:
            document = self._documents[document_id].model_copy(
                update={
                    "status": DocumentStatus.READY,
                    "page_count": page_count,
                    "extracted_characters": extracted_characters,
                    "chunk_count": len(chunks),
                    "chunks": chunks,
                }
            )
            self._documents[document_id] = document
            return document

    def mark_failed(self, document_id: str, error: str) -> DocumentDetail:
        with self._lock:
            document = self._documents[document_id].model_copy(update={"status": DocumentStatus.FAILED, "error": error})
            self._documents[document_id] = document
            return document

    def get(self, document_id: str) -> DocumentDetail | None:
        with self._lock:
            return self._documents.get(document_id)

    def list(self) -> list[DocumentSummary]:
        with self._lock:
            return [DocumentSummary(**document.model_dump(exclude={"chunks"})) for document in self._documents.values()]
