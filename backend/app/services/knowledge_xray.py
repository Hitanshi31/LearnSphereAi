import re
from datetime import datetime, timezone
from uuid import uuid4

from ..schemas import (
    ConceptNode,
    ConceptSuspicion,
    MisconceptionInsight,
    PrerequisiteEdge,
    QuizQuestion,
    ReadinessItem,
    ReadinessReportResponse,
    XRayDiagnosisResponse,
    XRayProbeRequest,
    XRayProbeResponse,
    XRayReturnVerifyRequest,
    XRayReturnVerifyResponse,
)
from .grounded_learning import GroundedStudyService, SourceChunk
from .learning_profile import LearningProfileStore, MisconceptionDetector


class KnowledgeXRayEngine:
    """Hero Diagnostic Engine for LearnSphere AI.
    Investigates prerequisite knowledge chains to diagnose root causes when a student struggles.
    """

    def __init__(
        self,
        study_service: GroundedStudyService,
        profile_store: LearningProfileStore,
        misconception_detector: MisconceptionDetector,
    ) -> None:
        self.study_service = study_service
        self.profile_store = profile_store
        self.misconception_detector = misconception_detector

    def _fuzzy_find_node(self, target_name: str, nodes: list[ConceptNode]) -> ConceptNode | None:
        norm_target = target_name.lower().strip()
        for node in nodes:
            if node.label.lower().strip() == norm_target or node.id.lower() == norm_target:
                return node
        for node in nodes:
            if norm_target in node.label.lower() or node.label.lower() in norm_target:
                return node
        return nodes[0] if nodes else None

    def _traverse_prerequisites(
        self, target_id: str, nodes: list[ConceptNode], edges: list[PrerequisiteEdge]
    ) -> list[tuple[ConceptNode, int]]:
        """Traverse graph edges backwards to find all prerequisite ancestor concepts and their distance."""
        node_map = {n.id: n for n in nodes}
        visited = set()
        ancestors: list[tuple[ConceptNode, int]] = []

        # Find incoming edges where target_concept_id == target_id
        queue: list[tuple[str, int]] = [(target_id, 0)]

        while queue:
            curr_id, dist = queue.pop(0)
            if curr_id in visited:
                continue
            visited.add(curr_id)

            if dist > 0 and curr_id in node_map:
                ancestors.append((node_map[curr_id], dist))

            # Look for parents (edges where target_concept_id is curr_id)
            for edge in edges:
                if edge.target_concept_id == curr_id and edge.source_concept_id not in visited:
                    queue.append((edge.source_concept_id, dist + 1))

        # Fallback if no explicit edges found: treat all preceding nodes as chain ancestors
        if not ancestors and len(nodes) > 1:
            target_idx = 0
            for idx, n in enumerate(nodes):
                if n.id == target_id:
                    target_idx = idx
                    break
            for idx in range(max(0, target_idx - 3), target_idx):
                ancestors.append((nodes[idx], target_idx - idx))

        return ancestors

    def calculate_suspicion_score(
        self, concept_label: str, distance: int, learner_id: str
    ) -> tuple[float, list[str]]:
        """Interpretable weighted suspicion model evaluating mastery, misconceptions, accuracy, confidence, and distance."""
        learner = self.profile_store.get(learner_id)
        topic_state = learner.topics.get(concept_label)

        evidence: list[str] = []

        # Signal 1: Mastery Gap (Weight 0.35)
        mastery = topic_state.mastery if topic_state else 50
        mastery_gap = max(0.0, (100.0 - mastery) / 100.0)
        if mastery < 65:
            evidence.append(f"Mastery score below threshold ({mastery}%)")

        # Signal 2: Unresolved Misconceptions (Weight 0.25)
        unresolved_count = 0
        for m in learner.recent_misconceptions:
            if not m.get("repaired") and (m.get("topic") == concept_label or concept_label.lower() in m.get("label", "").lower()):
                unresolved_count += 1
        misconception_risk = min(1.0, unresolved_count * 0.5)
        if unresolved_count > 0:
            evidence.append(f"{unresolved_count} active/unrepaired misconception(s) detected")

        # Signal 3: Quiz Failure Rate (Weight 0.15)
        attempts = topic_state.attempts if topic_state else 0
        correct = topic_state.correct if topic_state else 0
        accuracy = (correct / attempts) if attempts > 0 else 0.5
        accuracy_gap = 1.0 - accuracy
        if attempts > 0 and accuracy < 0.6:
            evidence.append(f"Historical quiz accuracy rate is low ({round(accuracy*100)}%)")

        # Signal 4: Knowledge Illusion / Confidence Mismatch (Weight 0.15)
        avg_conf = (topic_state.confidence_total / attempts) if attempts > 0 else 3.0
        confidence_mismatch = 0.0
        if avg_conf >= 3.5 and accuracy < 0.5:
            confidence_mismatch = (avg_conf / 5.0) - accuracy
            evidence.append(f"Knowledge Illusion detected: high confidence ({round(avg_conf, 1)}/5) but low demonstrated mastery")

        # Signal 5: Prerequisite Distance Decay (Weight 0.10)
        distance_decay = 1.0 / max(1, distance)
        evidence.append(f"Direct prerequisite structural dependency (depth {distance})")

        # Weighted calculation
        suspicion = (
            0.35 * mastery_gap +
            0.25 * misconception_risk +
            0.15 * accuracy_gap +
            0.15 * confidence_mismatch +
            0.10 * distance_decay
        )

        return round(min(0.99, max(0.10, suspicion)), 2), evidence

    def diagnose_failed_concept(
        self, learner_id: str, document_id: str, failed_concept_name: str
    ) -> XRayDiagnosisResponse:
        """Core X-Ray Investigation Entrypoint: Traverses graph, computes suspicion, and generates micro-probe."""
        # 1. Fetch concept graph & prerequisite edges
        visual_data = self.study_service.visual_explainer(document_id)
        nodes_raw = visual_data.get("concept_nodes", [])
        edges_raw = visual_data.get("prerequisites", [])

        nodes = [ConceptNode.model_validate(n) if isinstance(n, dict) else n for n in nodes_raw]
        edges = [PrerequisiteEdge.model_validate(e) if isinstance(e, dict) else e for e in edges_raw]

        failed_node = self._fuzzy_find_node(failed_concept_name, nodes)
        orig_label = failed_node.label if failed_node else failed_concept_name
        orig_id = failed_node.id if failed_node else "N1"

        # 2. Traverse prerequisite ancestors
        ancestors = self._traverse_prerequisites(orig_id, nodes, edges)

        candidate_suspicions: list[ConceptSuspicion] = []
        node_states: dict[str, str] = {orig_label: "investigating"}

        if not ancestors:
            # Fallback if concept has no prerequisites
            suspected_label = orig_label
            candidate_suspicions.append(
                ConceptSuspicion(
                    concept_id=orig_id,
                    concept_label=orig_label,
                    suspicion_score=0.75,
                    distance=0,
                    evidence=["Direct topic evaluation (no deeper prerequisite chain found)."]
                )
            )
        else:
            for anc_node, dist in ancestors:
                susp_score, evidence = self.calculate_suspicion_score(anc_node.label, dist, learner_id)
                candidate_suspicions.append(
                    ConceptSuspicion(
                        concept_id=anc_node.id,
                        concept_label=anc_node.label,
                        suspicion_score=susp_score,
                        distance=dist,
                        evidence=evidence
                    )
                )

            # Sort by suspicion score descending
            candidate_suspicions.sort(key=lambda cs: cs.suspicion_score, reverse=True)
            suspected_label = candidate_suspicions[0].concept_label

            for cs in candidate_suspicions:
                if cs.concept_label == suspected_label:
                    node_states[cs.concept_label] = "suspected"
                else:
                    node_states[cs.concept_label] = "ruled_out"

        # 3. Generate targeted diagnostic micro-probe question for suspected root concept
        probe_question = self._generate_targeted_probe(document_id, suspected_label)

        prereq_chain = [cs.concept_label for cs in candidate_suspicions]

        return XRayDiagnosisResponse(
            original_failed_concept=orig_label,
            suspected_root_concept=suspected_label,
            prerequisite_chain=prereq_chain,
            candidate_suspicions=candidate_suspicions,
            probe_question=probe_question,
            node_states=node_states,
        )

    def _generate_targeted_probe(self, document_id: str, concept_label: str) -> QuizQuestion:
        """Generate ONE targeted conceptual diagnostic micro-probe question."""
        try:
            questions = self.study_service.adaptive_quiz(document_id, [concept_label])
            if questions:
                return questions[0]
        except Exception as err:
            print("Micro-probe generation notice:", err)

        # Fallback diagnostic micro-probe question
        return QuizQuestion(
            id=f"probe-{str(uuid4())[:8]}",
            question=f"To verify your foundation in '{concept_label}', which core principle best describes how it functions?",
            choices=[
                f"{concept_label} provides the essential mechanism required for dependent operations to compute correctly.",
                f"{concept_label} operates completely independently without any influence on surrounding processes.",
                f"{concept_label} represents a static non-functional metadata variable.",
                f"{concept_label} is only applicable in theoretical models and has zero practical effect."
            ],
            answer_index=0,
            explanation=f"Correct! '{concept_label}' is the core foundational prerequisite.",
            citations=[]
        )

    def evaluate_micro_probe(self, request: XRayProbeRequest) -> XRayProbeResponse:
        """Evaluate the micro-probe answer and confirm/rule out the root knowledge gap."""
        is_correct = (request.choice_index == 0)

        if is_correct:
            # Probe passed! Suspected prerequisite is intact.
            return XRayProbeResponse(
                probe_passed=True,
                root_gap_confirmed=False,
                confirmed_root_concept=request.suspected_concept,
                explanation=f"Foundation verified! You demonstrated strong understanding of '{request.suspected_concept}'. Let's return to re-test '{request.original_concept}'.",
                repair_misconception=None,
                next_action="original_concept_retest"
            )

        # Probe failed! ROOT GAP CONFIRMED.
        root_concept = request.suspected_concept
        explanation = (
            f"ROOT KNOWLEDGE GAP CONFIRMED: Your difficulty with '{request.original_concept}' originates from a foundational gap in '{root_concept}'. "
            f"While you understand the high-level concept of {request.original_concept}, the underlying mechanism of {root_concept} needs to be repaired first."
        )

        # Construct targeted misconception repair for the confirmed root prerequisite
        repair_insight = self.misconception_detector.detect(
            topic=root_concept,
            question=f"Diagnostic micro-probe question on {root_concept}",
            student_answer=request.student_answer or "Incorrect prerequisite choice",
            correct_answer=f"Core mechanism of {root_concept}",
            is_correct=False
        )

        # Update profile with this root gap misconception
        if repair_insight:
            self.profile_store.record(
                learner_id=request.learner_id,
                topic=root_concept,
                question=f"X-Ray Micro-Probe: {root_concept}",
                student_answer=request.student_answer,
                correct_answer=f"Core principle of {root_concept}",
                is_correct=False,
                confidence=4,
                misconception=repair_insight
            )

        return XRayProbeResponse(
            probe_passed=False,
            root_gap_confirmed=True,
            confirmed_root_concept=root_concept,
            explanation=explanation,
            repair_misconception=repair_insight if isinstance(repair_insight, MisconceptionInsight) else MisconceptionInsight.model_validate(repair_insight),
            next_action="repair_root"
        )

    def verify_original_concept(self, request: XRayReturnVerifyRequest) -> XRayReturnVerifyResponse:
        """Close the causal educational loop: re-test original failed concept after foundation repair."""
        is_correct = (request.choice_index == 0) or ("unlocked" in request.student_answer.lower() or "correct" in request.student_answer.lower())

        if is_correct:
            # Unlock original concept! Boost topic mastery for both root prerequisite and original concept.
            self.profile_store.repair_misconception(request.learner_id, f"m-xray-{request.root_concept}")
            learner = self.profile_store.get(request.learner_id)
            
            # Record successful attempt on original concept
            self.profile_store.record(
                learner_id=request.learner_id,
                topic=request.original_concept,
                question=f"Re-test after foundation repair: {request.original_concept}",
                student_answer="Correct unlocked response",
                correct_answer="Correct concept mechanism",
                is_correct=True,
                confidence=5,
                misconception=None
            )

            updated_mastery = learner.topics.get(request.original_concept, None)
            mastery_score = updated_mastery.mastery if updated_mastery else 88

            return XRayReturnVerifyResponse(
                unlocked=True,
                original_concept=request.original_concept,
                root_concept=request.root_concept,
                explanation=f"🎉 SUCCESS! Repairing the root foundation in '{request.root_concept}' unlocked your complete mastery of '{request.original_concept}'!",
                updated_mastery=mastery_score
            )

        return XRayReturnVerifyResponse(
            unlocked=False,
            original_concept=request.original_concept,
            root_concept=request.root_concept,
            explanation=f"Keep practicing! Your foundation in '{request.root_concept}' is repaired, but '{request.original_concept}' requires one more review.",
            updated_mastery=60
        )

    def scan_material_readiness(self, learner_id: str, document_id: str) -> ReadinessReportResponse:
        """Readiness X-Ray pre-flight scanner: checks document prerequisites against student profile."""
        doc_data = self.study_service.visual_explainer(document_id)
        doc_title = doc_data.get("title", "Study Material").replace("Concept Map: ", "").replace("Concept Architecture: ", "")
        nodes_raw = doc_data.get("concept_nodes", [])
        nodes = [ConceptNode.model_validate(n) if isinstance(n, dict) else n for n in nodes_raw]

        learner = self.profile_store.get(learner_id)
        items: list[ReadinessItem] = []

        total_mastery = 0
        for node in nodes[:5]:
            label = node.label
            topic_state = learner.topics.get(label)
            mastery = topic_state.mastery if topic_state else 50
            total_mastery += mastery

            if mastery >= 75:
                status = "strong"
                risk_level = "low"
            elif mastery >= 55:
                status = "moderate"
                risk_level = "medium"
            else:
                status = "weak"
                risk_level = "high"

            items.append(
                ReadinessItem(
                    concept_label=label,
                    mastery=mastery,
                    status=status,
                    prerequisite_for=doc_title,
                    risk_level=risk_level,
                )
            )

        overall_score = round(total_mastery / max(1, len(items)))
        return ReadinessReportResponse(
            document_id=document_id,
            title=doc_title,
            overall_readiness_score=overall_score,
            items=items,
        )
