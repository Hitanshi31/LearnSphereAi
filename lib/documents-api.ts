export type Citation = {
  chunk_id: string;
  page_number: number;
  excerpt: string;
};

export type UploadedDocument = {
  id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
  page_count: number;
  chunk_count: number;
  extracted_characters: number;
  created_at: string;
  error?: string;
};

export type StudyAnswer = {
  answer: string;
  citations: Citation[];
};

export type KeyConcept = {
  term: string;
  definition: string;
};

export type StudyNotes = {
  document_id: string;
  summary: string;
  notes: string;
  key_concepts: KeyConcept[];
  citations: Citation[];
};

export type QuizQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  citations: Citation[];
};

export type Quiz = {
  document_id: string;
  questions: QuizQuestion[];
};

export type MisconceptionInsight = {
  id: string;
  topic: string;
  label: string;
  why: string;
  common_intuition: string;
  scientific_reality: string;
  correction: string;
  verification_check: string;
  verification_options: string[];
  verification_correct_index: number;
  created_at: string;
  repaired?: boolean;
  repaired_at?: string;
};

export type AttemptRecord = {
  id: string;
  topic: string;
  question: string;
  student_answer: string;
  correct_answer: string;
  confidence: number;
  is_correct: boolean;
  timestamp: string;
};

export type TopicMastery = {
  topic: string;
  mastery: number;
  attempts: number;
  correct: number;
  confidence: number;
  misconception_count: number;
};

export type LearningProfile = {
  learner_id: string;
  overall_mastery: number;
  accuracy_rate: number;
  confidence_alignment: number;
  total_attempts: number;
  topics: TopicMastery[];
  recent_misconceptions: MisconceptionInsight[];
  attempt_history: AttemptRecord[];
};

export type SubmitAttemptInput = {
  learnerId?: string;
  topic: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  confidence: number;
  isCorrect: boolean;
};

const API_URL_CANDIDATES = [
  process.env.NEXT_PUBLIC_API_URL,
  "http://127.0.0.1:8001",
  "http://localhost:8001",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
].filter(Boolean) as string[];

let activeApiUrl = API_URL_CANDIDATES[0];

async function resolveApiUrl(): Promise<string> {
  for (const baseUrl of API_URL_CANDIDATES) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/documents`, { method: "GET" });
      if (res.ok) {
        activeApiUrl = baseUrl;
        return baseUrl;
      }
    } catch {
      continue;
    }
  }
  return activeApiUrl;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let baseUrl = activeApiUrl;
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail ?? "LearnSphere request could not be completed.");
    }
    return response.json() as Promise<T>;
  } catch (error) {
    // Retry with resolved active port if connection failed
    const resolvedUrl = await resolveApiUrl();
    if (resolvedUrl !== baseUrl) {
      const response = await fetch(`${resolvedUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "LearnSphere request could not be completed.");
      }
      return response.json() as Promise<T>;
    }
    throw error;
  }
}

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const form = new FormData();
  form.append("file", file);
  let baseUrl = activeApiUrl;

  try {
    const response = await fetch(`${baseUrl}/api/v1/documents`, {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.detail ?? "Upload failed. Please ensure the file is a valid PDF.");
    }
    return body as UploadedDocument;
  } catch (error) {
    const resolvedUrl = await resolveApiUrl();
    const response = await fetch(`${resolvedUrl}/api/v1/documents`, {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.detail ?? "Upload failed. Please ensure the file is a valid PDF.");
    }
    return body as UploadedDocument;
  }
}

export async function listDocuments(): Promise<UploadedDocument[]> {
  return apiJson<UploadedDocument[]>("/api/v1/documents");
}

export async function getDocument(documentId: string): Promise<UploadedDocument> {
  return apiJson<UploadedDocument>(`/api/v1/documents/${documentId}`);
}

export async function askStudyQuestion(documentId: string, question: string): Promise<StudyAnswer> {
  return apiJson<StudyAnswer>("/api/v1/study/chat", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, question }),
  });
}

export async function generateNotes(documentId: string): Promise<StudyNotes> {
  return apiJson<StudyNotes>(`/api/v1/documents/${documentId}/notes`, {
    method: "POST",
  });
}

export async function generateQuiz(documentId: string): Promise<Quiz> {
  return apiJson<Quiz>(`/api/v1/documents/${documentId}/quiz`, {
    method: "POST",
  });
}

export async function getLearningProfile(learnerId = "alex"): Promise<LearningProfile> {
  return apiJson<LearningProfile>(`/api/v1/learners/${learnerId}/profile`);
}

export async function submitAttempt(input: SubmitAttemptInput): Promise<{
  profile: LearningProfile;
  misconception: MisconceptionInsight | null;
}> {
  return apiJson<{
    profile: LearningProfile;
    misconception: MisconceptionInsight | null;
  }>("/api/v1/learning/attempts", {
    method: "POST",
    body: JSON.stringify({
      learner_id: input.learnerId ?? "alex",
      topic: input.topic,
      question: input.question,
      student_answer: input.studentAnswer,
      correct_answer: input.correctAnswer,
      confidence: input.confidence,
      is_correct: input.isCorrect,
    }),
  });
}

export async function repairMisconception(
  misconceptionId: string,
  learnerId = "alex"
): Promise<LearningProfile> {
  return apiJson<LearningProfile>("/api/v1/learning/repair-misconception", {
    method: "POST",
    body: JSON.stringify({
      learner_id: learnerId,
      misconception_id: misconceptionId,
    }),
  });
}

// ─── YouTube ingestion ────────────────────────────────────────────────────────

export type YoutubeIngestResult = {
  document_id: string;
  video_id: string;
  title: string;
  chunk_count: number;
  total_words: number;
  language: string;
  status: string;
};

export async function ingestYoutube(url: string): Promise<YoutubeIngestResult> {
  return apiJson<YoutubeIngestResult>("/api/v1/youtube", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// ─── Visual explainer ─────────────────────────────────────────────────────────

export type ConceptNode = {
  id: string;
  label: string;
  summary: string;
  type: "core" | "process" | "outcome" | "definition";
  diagnostic_state?: string;
};

export type VisualExplainer = {
  document_id: string;
  title: string;
  mermaid_code: string;
  concept_nodes: ConceptNode[];
  prerequisites?: PrerequisiteEdge[];
};

export async function generateVisual(
  documentId: string,
  isYoutube = false,
): Promise<VisualExplainer> {
  const base = isYoutube ? `/api/v1/youtube/${documentId}` : `/api/v1/documents/${documentId}`;
  return apiJson<VisualExplainer>(`${base}/visual`, { method: "POST" });
}

// ─── Explain in different styles ──────────────────────────────────────────────

export type ExplainStyle = "beginner" | "visual" | "programmer" | "researcher" | "story" | "interview";

export type StyleExplanation = {
  document_id: string;
  topic: string;
  style: string;
  content: string;
};

export async function explainInStyle(
  documentId: string,
  topic: string,
  style: ExplainStyle,
  isYoutube = false,
): Promise<StyleExplanation> {
  const base = isYoutube ? `/api/v1/youtube/${documentId}` : `/api/v1/documents/${documentId}`;
  return apiJson<StyleExplanation>(`${base}/explain`, {
    method: "POST",
    body: JSON.stringify({ topic, style }),
  });
}

// ─── Adaptive quiz ────────────────────────────────────────────────────────────

export async function generateAdaptiveQuiz(
  documentId: string,
  learnerId = "alex",
): Promise<Quiz> {
  return apiJson<Quiz>(`/api/v1/documents/${documentId}/adaptive-quiz`, {
    method: "POST",
    body: JSON.stringify({ learner_id: learnerId }),
  });
}

// ─── Audio & Speech Narration ──────────────────────────────────────────────────

export type AudioSection = {
  title: string;
  text: string;
  estimated_duration_sec: number;
};

export type AudioNarration = {
  document_id: string;
  title: string;
  total_sections: number;
  estimated_total_minutes: number;
  sections: AudioSection[];
};

export async function getAudioNarration(documentId: string): Promise<AudioNarration> {
  return apiJson<AudioNarration>(`/api/v1/documents/${documentId}/audio-narration`);
}

// ─── Knowledge X-Ray Diagnostic Engine ─────────────────────────────────────────

export type PrerequisiteEdge = {
  source_concept_id: string;
  target_concept_id: string;
  relationship: string;
  confidence: number;
};

export type ConceptSuspicion = {
  concept_id: string;
  concept_label: string;
  suspicion_score: number;
  distance: number;
  evidence: string[];
};

export type XRayDiagnosisResponse = {
  original_failed_concept: string;
  suspected_root_concept: string;
  prerequisite_chain: string[];
  candidate_suspicions: ConceptSuspicion[];
  probe_question: QuizQuestion | null;
  node_states: Record<string, string>;
};

export type XRayProbeResponse = {
  probe_passed: boolean;
  root_gap_confirmed: boolean;
  confirmed_root_concept: string;
  explanation: string;
  repair_misconception: MisconceptionInsight | null;
  next_action: "repair_root" | "evaluate_next_prerequisite" | "original_concept_retest";
};

export type XRayReturnVerifyResponse = {
  unlocked: boolean;
  original_concept: string;
  root_concept: string;
  explanation: string;
  updated_mastery: number;
};

export type ReadinessItem = {
  concept_label: string;
  mastery: number;
  status: "strong" | "moderate" | "weak";
  prerequisite_for: string;
  risk_level: "low" | "medium" | "high";
};

export type ReadinessReportResponse = {
  document_id: string;
  title: string;
  overall_readiness_score: number;
  items: ReadinessItem[];
};

export async function initiateXRayDiagnose(
  documentId: string,
  failedConcept: string,
  question = "",
  studentAnswer = "",
  learnerId = "alex",
): Promise<XRayDiagnosisResponse> {
  return apiJson<XRayDiagnosisResponse>(`/api/v1/xray/diagnose`, {
    method: "POST",
    body: JSON.stringify({
      learner_id: learnerId,
      document_id: documentId,
      failed_concept: failedConcept,
      question,
      student_answer: studentAnswer,
    }),
  });
}

export async function submitXRayProbe(
  documentId: string,
  originalConcept: string,
  suspectedConcept: string,
  choiceIndex: number,
  studentAnswer = "",
  learnerId = "alex",
): Promise<XRayProbeResponse> {
  return apiJson<XRayProbeResponse>(`/api/v1/xray/probe`, {
    method: "POST",
    body: JSON.stringify({
      learner_id: learnerId,
      document_id: documentId,
      original_concept: originalConcept,
      suspected_concept: suspectedConcept,
      choice_index: choiceIndex,
      student_answer: studentAnswer,
    }),
  });
}

export async function verifyOriginalConceptXRay(
  documentId: string,
  originalConcept: string,
  rootConcept: string,
  choiceIndex: number,
  studentAnswer = "",
  learnerId = "alex",
): Promise<XRayReturnVerifyResponse> {
  return apiJson<XRayReturnVerifyResponse>(`/api/v1/xray/return-verify`, {
    method: "POST",
    body: JSON.stringify({
      learner_id: learnerId,
      document_id: documentId,
      original_concept: originalConcept,
      root_concept: rootConcept,
      choice_index: choiceIndex,
      student_answer: studentAnswer,
    }),
  });
}

export async function getReadinessXRay(
  documentId: string,
  learnerId = "alex",
): Promise<ReadinessReportResponse> {
  return apiJson<ReadinessReportResponse>(`/api/v1/xray/readiness/${documentId}?learner_id=${learnerId}`);
}


