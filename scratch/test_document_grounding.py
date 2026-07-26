import sys
import os
from pathlib import Path

# Force UTF-8 encoding for standard output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend to path
sys.path.insert(0, str(Path("./backend").resolve()))

from app.config import Settings
from app.services.grounded_learning import (
    VectorIndex,
    GeminiClient,
    GroundedStudyService,
    SourceChunk
)

def test_grounding():
    settings = Settings()
    index = VectorIndex(settings)
    gemini = GeminiClient(settings)
    service = GroundedStudyService(index, gemini)

    # Index sample document chunks about Quantum Computing
    doc_id = "test-doc-grounding-123"
    chunks = [
        SourceChunk(
            id="c1",
            page_number=1,
            text="Quantum Computing utilizes quantum mechanics principles such as superposition and entanglement. Unlike classical bits that store 0 or 1, qubits can exist in a superposition of both states simultaneously."
        ),
        SourceChunk(
            id="c2",
            page_number=2,
            text="Quantum Entanglement links pairs of qubits such that measuring one instantaneously determines the state of the other, regardless of distance. Shor's algorithm provides exponential speedup for integer factorization."
        ),
        SourceChunk(
            id="c3",
            page_number=3,
            text="Quantum Decoherence is the primary physical challenge where external environmental noise causes quantum state collapse, destroying quantum information before computations complete."
        )
    ]

    print("Indexing test document chunks into ChromaDB...")
    index.index(doc_id, chunks)

    print("\n--- Testing Document Grounded Notes & Executive Summary (HF Priority) ---")
    summary, notes_md, concepts, citations = service.notes(doc_id)
    print("SUMMARY LENGTH:", len(summary))
    print("KEY CONCEPTS COUNT:", len(concepts))
    for c in concepts:
        print(f"- {c.term}: {c.definition}")

    print("\n--- Testing Document Grounded Quiz ---")
    quiz_questions = service.quiz(doc_id)
    print("QUIZ QUESTIONS COUNT:", len(quiz_questions))

    print("\n--- Testing Document Grounded Visual Concept Map ---")
    visual = service.visual_explainer(doc_id)
    print("TITLE:", visual.get("title"))
    print("CONCEPT NODES COUNT:", len(visual.get("concept_nodes", [])))

    print("\nAll document-grounded tests passed successfully!")

if __name__ == "__main__":
    test_grounding()
