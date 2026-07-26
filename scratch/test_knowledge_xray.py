import sys
import os
from pathlib import Path

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
from app.services.learning_profile import LearningProfileStore, MisconceptionDetector
from app.services.knowledge_xray import KnowledgeXRayEngine
from app.schemas import (
    XRayProbeRequest,
    XRayReturnVerifyRequest
)

def test_knowledge_xray():
    print("==================================================")
    print("STARTING KNOWLEDGE X-RAY INTEGRATION TEST SUITE")
    print("==================================================")

    settings = Settings()
    index = VectorIndex(settings)
    gemini = GeminiClient(settings)
    study_service = GroundedStudyService(index, gemini)
    profile_store = LearningProfileStore()
    misconception_detector = MisconceptionDetector(gemini)

    xray_engine = KnowledgeXRayEngine(study_service, profile_store, misconception_detector)

    doc_id = "test-xray-quantum-123"
    chunks = [
        SourceChunk(
            id="qc1",
            page_number=1,
            text="Quantum Superposition is the foundational principle where a qubit exists in a linear combination of 0 and 1 until measurement."
        ),
        SourceChunk(
            id="qc2",
            page_number=2,
            text="Wave Function Collapse depends directly on Quantum Superposition when a measurement forces the system into a single definite state."
        ),
        SourceChunk(
            id="qc3",
            page_number=3,
            text="Quantum Entanglement relies on Wave Function Collapse to link correlated particle states across distances."
        )
    ]

    print("\n1. Indexing test document chunks into ChromaDB...")
    index.index(doc_id, chunks)

    print("\n2. Initiating Knowledge X-Ray Investigation for failed concept 'Quantum Entanglement'...")
    diagnosis = xray_engine.diagnose_failed_concept("alex", doc_id, "Quantum Entanglement")
    
    print(f"   Original Failed Concept: {diagnosis.original_failed_concept}")
    print(f"   Suspected Root Prerequisite: {diagnosis.suspected_root_concept}")
    print(f"   Prerequisite Chain: {diagnosis.prerequisite_chain}")
    print(f"   Candidate Suspicions Count: {len(diagnosis.candidate_suspicions)}")
    
    for cand in diagnosis.candidate_suspicions:
        print(f"     - Candidate: {cand.concept_label} | Score: {cand.suspicion_score} | Distance: {cand.distance}")
        for ev in cand.evidence:
            print(f"         * {ev}")

    assert diagnosis.suspected_root_concept is not None, "Suspected root concept should not be None"
    assert len(diagnosis.candidate_suspicions) > 0, "Candidate suspicions should not be empty"

    print("\n3. Testing Micro-Probe Evaluation (Simulating failed probe answer)...")
    probe_req = XRayProbeRequest(
        learner_id="alex",
        document_id=doc_id,
        original_concept=diagnosis.original_failed_concept,
        suspected_concept=diagnosis.suspected_root_concept,
        choice_index=2, # Incorrect choice
        student_answer="Incorrect prerequisite choice"
    )
    probe_res = xray_engine.evaluate_micro_probe(probe_req)

    print(f"   Probe Passed: {probe_res.probe_passed}")
    print(f"   Root Gap Confirmed: {probe_res.root_gap_confirmed}")
    print(f"   Confirmed Root Concept: {probe_res.confirmed_root_concept}")
    print(f"   Explanation: {probe_res.explanation[:120]}...")
    assert probe_res.root_gap_confirmed is True, "Root gap must be confirmed on probe failure"

    print("\n4. Testing Return-to-Original Concept Retest (Closing the causal loop)...")
    retest_req = XRayReturnVerifyRequest(
        learner_id="alex",
        document_id=doc_id,
        original_concept=diagnosis.original_failed_concept,
        root_concept=probe_res.confirmed_root_concept,
        choice_index=0, # Correct choice after foundation repair
        student_answer="I now understand how the underlying prerequisite connects and resolves this concept correctly."
    )
    retest_res = xray_engine.verify_original_concept(retest_req)

    print(f"   Original Concept Unlocked: {retest_res.unlocked}")
    print(f"   Explanation: {retest_res.explanation}")
    print(f"   Updated Mastery: {retest_res.updated_mastery}%")
    assert retest_res.unlocked is True, "Original concept should be unlocked after successful re-test"

    print("\n5. Testing Secondary Readiness X-Ray Pre-Flight Scanner...")
    readiness = xray_engine.scan_material_readiness("alex", doc_id)
    print(f"   Readiness Document Title: {readiness.title}")
    print(f"   Overall Readiness Score: {readiness.overall_readiness_score}%")
    print(f"   Items Assessed Count: {len(readiness.items)}")
    for item in readiness.items:
        print(f"     - {item.concept_label}: Mastery={item.mastery}% | Status={item.status} | Risk={item.risk_level}")

    print("\n==================================================")
    print("ALL KNOWLEDGE X-RAY INTEGRATION TESTS PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    test_knowledge_xray()
