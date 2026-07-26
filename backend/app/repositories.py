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

        if not self._documents:
            self._seed_default_documents()

    def _seed_default_documents(self) -> None:
        """Seed rich academic materials so hackathon judges can test study tools immediately."""
        now = datetime.now(timezone.utc)
        
        # 1. Quantum Mechanics & Superposition
        q_chunks = [
            ChunkPreview(
                id="doc-quantum-01:1",
                page_number=1,
                text="Quantum Mechanics is the fundamental theory in physics that describes the physical properties of nature at the atomic and subatomic scale. Unlike classical mechanics, quantum systems exhibit wave-particle duality, where photons and electrons display both wave-like interference and particle-like localized impacts. The wave function, denoted by psi, describes the quantum state of a system.",
                word_count=52,
            ),
            ChunkPreview(
                id="doc-quantum-01:2",
                page_number=2,
                text="Quantum Superposition states that any quantum system can exist in a linear combination of multiple physical states simultaneously until a measurement is conducted. Upon measurement, the wave function collapses into a single definitive state according to Born's probability rule. Quantum Entanglement occurs when pairs of particles interact such that the quantum state of each particle cannot be described independently.",
                word_count=56,
            ),
            ChunkPreview(
                id="doc-quantum-01:3",
                page_number=3,
                text="Heisenberg Uncertainty Principle asserts a fundamental limit to the precision with which certain pairs of physical properties, such as position (x) and momentum (p), can be known simultaneously: delta x times delta p is greater than or equal to h-bar divided by 2. Quantum Tunneling allows subatomic particles to pass through potential energy barriers higher than their kinetic energy.",
                word_count=58,
            ),
        ]
        doc1 = DocumentDetail(
            id="doc-quantum-01",
            filename="Quantum Mechanics & Superposition Guide.pdf",
            status=DocumentStatus.READY,
            page_count=3,
            chunk_count=len(q_chunks),
            extracted_characters=sum(len(c.text) for c in q_chunks),
            created_at=now,
            chunks=q_chunks,
        )
        self._documents[doc1.id] = doc1

        # 2. Neural Networks & Deep Learning
        nn_chunks = [
            ChunkPreview(
                id="doc-neural-02:1",
                page_number=1,
                text="Artificial Neural Networks (ANNs) are computing systems inspired by biological neural networks. An ANN consists of interconnected nodes called artificial neurons arranged in input layers, hidden layers, and output layers. Activation functions like ReLU, Sigmoid, and GELU introduce non-linearities, allowing neural networks to model complex non-linear functions.",
                word_count=48,
            ),
            ChunkPreview(
                id="doc-neural-02:2",
                page_number=2,
                text="Backpropagation is the central learning algorithm in deep learning. It calculates the gradient of the loss function with respect to each weight using the mathematical chain rule of calculus. Stochastic Gradient Descent (SGD) and adaptive optimizers like Adam iteratively adjust weights to minimize the loss metric during model training.",
                word_count=49,
            ),
            ChunkPreview(
                id="doc-neural-02:3",
                page_number=3,
                text="Overfitting occurs when a neural network memorizes training data noise rather than learning generalizable patterns. Regularization techniques such as Dropout, Batch Normalization, and Weight Decay (L2 regularization) prevent overfitting and improve generalization performance on unseen test datasets.",
                word_count=41,
            ),
        ]
        doc2 = DocumentDetail(
            id="doc-neural-02",
            filename="Neural Networks & Deep Learning Foundations.pdf",
            status=DocumentStatus.READY,
            page_count=3,
            chunk_count=len(nn_chunks),
            extracted_characters=sum(len(c.text) for c in nn_chunks),
            created_at=now,
            chunks=nn_chunks,
        )
        self._documents[doc2.id] = doc2

        # 3. Cellular Respiration & Energy Metabolism
        bio_chunks = [
            ChunkPreview(
                id="doc-bio-03:1",
                page_number=1,
                text="Cellular Respiration is the set of metabolic reactions taking place in biological cells to convert chemical energy from nutrients into Adenosine Triphosphate (ATP). The overall aerobic respiration process converts glucose and oxygen into carbon dioxide, water, and usable cellular ATP energy.",
                word_count=44,
            ),
            ChunkPreview(
                id="doc-bio-03:2",
                page_number=2,
                text="Glycolysis occurs in the cytoplasm, breaking down one molecule of glucose into two molecules of pyruvate while yielding a net gain of 2 ATP and 2 NADH. The Citric Acid Cycle (Krebs Cycle) occurs within the mitochondrial matrix, releasing carbon dioxide and generating electron carriers NADH and FADH2.",
                word_count=50,
            ),
            ChunkPreview(
                id="doc-bio-03:3",
                page_number=3,
                text="Oxidative Phosphorylation takes place in the inner mitochondrial membrane via the Electron Transport Chain (ETC). High-energy electrons pump protons across the membrane to create a proton-motive force. Chemiosmosis drives ATP Synthase to generate approximately 30 to 32 ATP molecules per glucose molecule.",
                word_count=45,
            ),
        ]
        doc3 = DocumentDetail(
            id="doc-bio-03",
            filename="Cellular Respiration & Energy Metabolism.pdf",
            status=DocumentStatus.READY,
            page_count=3,
            chunk_count=len(bio_chunks),
            extracted_characters=sum(len(c.text) for c in bio_chunks),
            created_at=now,
            chunks=bio_chunks,
        )
        self._documents[doc3.id] = doc3
        self._save()

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

    def create(self, filename: str, created_at, document_id: str | None = None) -> DocumentDetail:
        doc_id = document_id if document_id else str(uuid4())
        document = DocumentDetail(
            id=doc_id, filename=filename, status=DocumentStatus.PROCESSING, created_at=created_at
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
