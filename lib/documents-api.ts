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

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
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

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiUrl}/api/v1/documents`, {
    method: "POST",
    body: form,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail ?? "Upload failed. Please ensure the file is a valid PDF.");
  }
  return body as UploadedDocument;
}

export async function listDocuments(): Promise<UploadedDocument[]> {
  return apiJson<UploadedDocument[]>("/api/v1/documents");
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
