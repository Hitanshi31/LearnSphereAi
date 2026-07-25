import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from .schemas import ChunkPreview, DocumentDetail, DocumentStatus, DocumentSummary


_PERSIST_FILE = Path("./data/documents.json")


def _serialize_document(doc: DocumentDetail) -> dict:
    return doc.model_dump(mode="json")


def _deserialize_document(data: dict) -> DocumentDetail:
    return DocumentDetail.model_validate(data)


class DocumentRepository:
    """JSON-file-backed repository — survives server restarts.
    Replaceable interface for PostgreSQL in Milestone 4."""

    def __init__(self) -> None:
        self._documents: dict[str, DocumentDetail] = {}
        self._files: dict[str, str] = {}  # document_id -> str path
        self._lock = Lock()
        self._load()

    # ------------------------------------------------------------------ #
    # Persistence helpers
    # ------------------------------------------------------------------ #

    def _load(self) -> None:
        """Load persisted documents from disk if available."""
        if not _PERSIST_FILE.exists():
            return
        try:
            raw = json.loads(_PERSIST_FILE.read_text(encoding="utf-8"))
            for entry in raw.get("documents", []):
                doc = _deserialize_document(entry)
                self._documents[doc.id] = doc
            for doc_id, path_str in raw.get("files", {}).items():
                if Path(path_str).exists():
                    self._files[doc_id] = path_str
        except Exception as err:
            print(f"[DocumentRepository] Could not load persisted data: {err}")

    def _save(self) -> None:
        """Persist current state to disk (called inside lock)."""
        try:
            _PERSIST_FILE.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "documents": [_serialize_document(doc) for doc in self._documents.values()],
                "files": self._files,
            }
            _PERSIST_FILE.write_text(json.dumps(payload, default=str, indent=2), encoding="utf-8")
        except Exception as err:
            print(f"[DocumentRepository] Could not save persisted data: {err}")

    # ------------------------------------------------------------------ #
    # Public interface
    # ------------------------------------------------------------------ #

    def create(self, filename: str, created_at) -> DocumentDetail:
        document = DocumentDetail(
            id=str(uuid4()), filename=filename, status=DocumentStatus.PROCESSING, created_at=created_at
        )
        with self._lock:
            self._documents[document.id] = document
            self._save()
        return document

    def attach_file(self, document_id: str, path: Path) -> None:
        with self._lock:
            self._files[document_id] = str(path)
            self._save()

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
            self._save()
            return document

    def mark_failed(self, document_id: str, error: str) -> DocumentDetail:
        with self._lock:
            document = self._documents[document_id].model_copy(update={"status": DocumentStatus.FAILED, "error": error})
            self._documents[document_id] = document
            self._save()
            return document

    def get(self, document_id: str) -> DocumentDetail | None:
        with self._lock:
            return self._documents.get(document_id)

    def list(self) -> list[DocumentSummary]:
        with self._lock:
            return [
                DocumentSummary(**document.model_dump(exclude={"chunks"}))
                for document in sorted(self._documents.values(), key=lambda d: d.created_at, reverse=True)
            ]
