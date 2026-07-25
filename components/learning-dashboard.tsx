"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  askStudyQuestion,
  explainInStyle,
  generateAdaptiveQuiz,
  generateNotes,
  generateQuiz,
  generateVisual,
  getDocument,
  getLearningProfile,
  ingestYoutube,
  listDocuments,
  submitAttempt,
  type Citation,
  type ConceptNode,
  type ExplainStyle,
  type KeyConcept,
  type LearningProfile,
  type MisconceptionInsight,
  type Quiz,
  type StyleExplanation,
  type StudyAnswer,
  type StudyNotes,
  type UploadedDocument,
  type VisualExplainer,
  type YoutubeIngestResult,
} from "@/lib/documents-api";

const learnerId = "alex";

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`card ${className}`} style={style}>{children}</section>;
}

function Ring({ value, label = "mastery" }: { value: number; label?: string }) {
  return (
    <div
      className="ring"
      style={{
        background: `conic-gradient(#6558f5 ${value * 3.6}deg, #ececf5 0deg)`,
      }}
    >
      <div>
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    ready: { background: "#d1fae5", color: "#065f46" },
    processing: { background: "#fef3c7", color: "#92400e" },
    failed: { background: "#fee2e2", color: "#991b1b" },
  };
  const s = styles[status] ?? styles.ready;
  return (
    <span
      style={{
        ...s,
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "20px",
        display: "inline-block",
      }}
    >
      {status}
    </span>
  );
}

function EmptyDocumentState({
  title = "No Active Material Selected",
  description = "Upload a PDF document or paste a YouTube URL in 'My materials' to unlock AI study tools, diagnostic quizzes, visual concept maps, and grounded Q&A.",
  onAction,
  actionText = "Go to My Materials →",
}: {
  title?: string;
  description?: string;
  onAction: () => void;
  actionText?: string;
}) {
  return (
    <Card className="ask" style={{ textAlign: "center", padding: "38px 24px" }}>
      <div style={{ fontSize: "36px", marginBottom: "10px" }}>📚</div>
      <h3 style={{ margin: "0 0 6px", color: "#202236" }}>{title}</h3>
      <p style={{ margin: "0 auto 18px", color: "#747789", fontSize: "13px", maxWidth: "440px" }}>
        {description}
      </p>
      <button className="primary" onClick={onAction}>
        {actionText}
      </button>
    </Card>
  );
}

function ConceptMapCard({
  title,
  mermaidCode,
  conceptNodes,
  busy,
  onGenerate,
  buttonText = "Generate Concept Map",
}: {
  title?: string;
  mermaidCode?: string;
  conceptNodes?: ConceptNode[];
  busy: boolean;
  onGenerate: () => void;
  buttonText?: string;
}) {
  return (
    <Card className="ask" style={{ marginTop: "18px" }}>
      <h3>🗺️ Visual Concept Map</h3>
      <p>Generate an AI-powered Mermaid diagram showing how key concepts in your material relate to each other.</p>
      <button className="primary" disabled={busy} onClick={onGenerate}>
        {busy ? "Generating map..." : mermaidCode ? "Regenerate Concept Map" : buttonText}
      </button>

      {mermaidCode && (
        <div style={{ marginTop: "20px" }}>
          <b style={{ color: "#564ad9", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            {title || "Concept Map"}
          </b>
          <div
            className="mermaid"
            style={{
              marginTop: "12px",
              padding: "20px",
              background: "#f7f6ff",
              borderRadius: "12px",
              border: "1px solid #dcd7fe",
              overflowX: "auto",
              fontSize: "13px",
            }}
            ref={(el) => {
              if (el && mermaidCode) {
                el.textContent = mermaidCode;
                // @ts-ignore
                if (typeof window !== "undefined" && (window as any).mermaid) {
                  el.removeAttribute("data-processed");
                  // @ts-ignore
                  (window as any).mermaid.run({ nodes: [el] });
                }
              }
            }}
          >
            {mermaidCode}
          </div>

          {conceptNodes && conceptNodes.length > 0 && (
            <>
              <b style={{ marginTop: "18px", display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px", color: "#564ad9" }}>
                CONCEPT NODES
              </b>
              <div className="concepts-grid" style={{ marginTop: "10px" }}>
                {conceptNodes.map((node) => (
                  <div
                    key={node.id}
                    className="concept-card"
                    style={{
                      borderLeft: `3px solid ${
                        node.type === "core" ? "#6255ef" : node.type === "process" ? "#f59e0b" : node.type === "outcome" ? "#22c55e" : "#94a3b8"
                      }`,
                    }}
                  >
                    <h4 style={{ margin: "0 0 4px", fontSize: "13px" }}>{node.label}</h4>
                    <p style={{ margin: 0, fontSize: "12px" }}>{node.summary}</p>
                    <span style={{ fontSize: "10px", color: "#9294a6", textTransform: "uppercase" }}>{node.type}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export function LearningDashboard() {
  const [nav, setNav] = useState("Overview");
  const [documentId, setDocumentId] = useState<string>();
  const [documentName, setDocumentName] = useState<string>("");
  const [docDetails, setDocDetails] = useState<UploadedDocument | null>(null);
  const [documentList, setDocumentList] = useState<UploadedDocument[]>([]);
  const [profile, setProfile] = useState<LearningProfile>();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<StudyAnswer>();
  const [notes, setNotes] = useState<StudyNotes>();
  const [quiz, setQuiz] = useState<Quiz>();
  const [quizMode, setQuizMode] = useState<"adaptive" | "standard">("adaptive");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number>();
  const [submittedIndexes, setSubmittedIndexes] = useState<Set<number>>(new Set());
  const [quizResults, setQuizResults] = useState<Array<{ correct: boolean; choice: number }>>([]);
  const [confidence, setConfidence] = useState<number>(4);
  const [insight, setInsight] = useState<MisconceptionInsight>();
  const [activeRepairModal, setActiveRepairModal] = useState<MisconceptionInsight | null>(null);
  const [verificationChoice, setVerificationChoice] = useState<number>();
  const [verificationResult, setVerificationResult] = useState<string>("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ingestMode, setIngestMode] = useState<"pdf" | "youtube">("pdf");
  const fileInput = useRef<HTMLInputElement>(null);

  // YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeBusy, setYoutubeBusy] = useState(false);

  // Visual explainer state
  const [visual, setVisual] = useState<VisualExplainer>();
  const [visualBusy, setVisualBusy] = useState(false);

  // Explain in style state
  const [explainTopic, setExplainTopic] = useState("");
  const [explainStyle, setExplainStyle] = useState<ExplainStyle>("beginner");
  const [styleExplanation, setStyleExplanation] = useState<StyleExplanation>();
  const [explainBusy, setExplainBusy] = useState(false);

  const refreshProfile = async () => {
    try {
      const p = await getLearningProfile(learnerId);
      setProfile(p);
    } catch {
      setStatus("Connect backend API (http://localhost:8000) to sync your live learning profile.");
    }
  };

  const refreshDocumentList = async () => {
    try {
      const docs = await listDocuments();
      setDocumentList(docs);
    } catch {
      // Silently ignore if backend is offline
    }
  };

  useEffect(() => {
    refreshProfile();
    refreshDocumentList();
  }, []);

  // Poll for document processing completion
  useEffect(() => {
    if (!documentId || docDetails?.status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const polled = await getDocument(documentId);
        setDocDetails(polled);

        if (polled.status === "ready") {
          clearInterval(interval);
          setDocumentName(polled.filename);
          setStatus(`✓ ${polled.filename} ready for study.`);
          refreshDocumentList();
          generateNotes(polled.id)
            .then(setNotes)
            .catch(() => {});
        } else if (polled.status === "failed") {
          clearInterval(interval);
          setStatus(`❌ Processing failed: ${polled.error ?? "Unknown error"}`);
        }
      } catch {
        // Keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, docDetails?.status]);

  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Please select a valid PDF document.");
      return;
    }
    setBusy(true);
    setStatus(`Uploading ${file.name}...`);
    try {
      const { uploadDocument } = await import("@/lib/documents-api");
      const doc = await uploadDocument(file);

      setDocumentId(doc.id);
      setDocumentName(doc.filename);
      setDocDetails(doc);
      setAnswer(undefined);
      setNotes(undefined);
      setQuiz(undefined);
      setVisual(undefined);
      setStyleExplanation(undefined);
      setCurrentQuestionIndex(0);
      setSubmittedIndexes(new Set());
      setQuizResults([]);
      setStatus("📄 PDF uploaded — indexing chunks into vector store...");

      setNav("My materials");
      refreshDocumentList();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  const triggerGlobalUpload = () => {
    fileInput.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const activateDocument = (doc: UploadedDocument) => {
    if (doc.status !== "ready") {
      setStatus(`"${doc.filename}" is not ready yet (status: ${doc.status}).`);
      return;
    }
    setDocumentId(doc.id);
    setDocumentName(doc.filename);
    setDocDetails(doc);
    setAnswer(undefined);
    setNotes(undefined);
    setQuiz(undefined);
    setVisual(undefined);
    setStyleExplanation(undefined);
    setCurrentQuestionIndex(0);
    setSubmittedIndexes(new Set());
    setQuizResults([]);
    setStatus(`Active material set to "${doc.filename}".`);

    generateNotes(doc.id).then(setNotes).catch(() => {});
  };

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!documentId || !question.trim()) return;
    setBusy(true);
    setAnswer(undefined);
    setStatus("");
    try {
      const res = await askStudyQuestion(documentId, question);
      setAnswer(res);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not answer that yet.");
    } finally {
      setBusy(false);
    }
  };

  const loadNotes = async () => {
    if (!documentId) return setStatus("Please select or upload material first.");
    setBusy(true);
    setStatus("Generating summary & notes...");
    try {
      const res = await generateNotes(documentId);
      setNotes(res);
      setStatus("Summary & Study Notes updated!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create notes.");
    } finally {
      setBusy(false);
    }
  };

  const startQuiz = async (mode: "adaptive" | "standard" = quizMode) => {
    if (!documentId) return setStatus("Please select or upload material first.");
    setBusy(true);
    setQuizMode(mode);
    setStatus(mode === "adaptive" ? "Generating adaptive quiz targeted to your weak topics..." : "Generating diagnostic quiz...");
    try {
      const res = mode === "adaptive"
        ? await generateAdaptiveQuiz(documentId, learnerId)
        : await generateQuiz(documentId);

      setQuiz(res);
      setCurrentQuestionIndex(0);
      setSelectedChoice(undefined);
      setSubmittedIndexes(new Set());
      setQuizResults([]);
      setStatus(mode === "adaptive" ? "⚡ Adaptive quiz generated!" : "Diagnostic quiz ready!");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not generate quiz.");
    } finally {
      setBusy(false);
    }
  };

  const submitQuizAttempt = async () => {
    const currentQ = quiz?.questions[currentQuestionIndex];
    if (!currentQ || selectedChoice === undefined) return;
    setBusy(true);
    setStatus("");
    const isCorrect = selectedChoice === currentQ.answer_index;
    try {
      const result = await submitAttempt({
        learnerId,
        topic: documentName ? documentName.replace(".pdf", "") : "Study Subject",
        question: currentQ.question,
        studentAnswer: currentQ.choices[selectedChoice],
        correctAnswer: currentQ.choices[currentQ.answer_index],
        confidence,
        isCorrect,
      });

      setProfile(result.profile);
      setSubmittedIndexes((prev) => new Set([...prev, currentQuestionIndex]));
      setQuizResults((prev) => {
        const updated = [...prev];
        updated[currentQuestionIndex] = { correct: isCorrect, choice: selectedChoice };
        return updated;
      });

      if (result.misconception) {
        setInsight(result.misconception);
        setStatus("Misconception detected! Learning profile updated with target insight.");
      } else if (isCorrect) {
        setStatus("Correct! Your mastery score increased.");
      } else {
        setStatus("Incorrect — learning profile updated to adapt future questions.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not record your answer.");
    } finally {
      setBusy(false);
    }
  };

  const goToNextQuestion = () => {
    if (!quiz) return;
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < quiz.questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setSelectedChoice(undefined);
      setConfidence(4);
      setStatus("");
    }
  };

  const handleVerificationCheck = () => {
    if (!activeRepairModal || verificationChoice === undefined) return;
    if (verificationChoice === activeRepairModal.verification_correct_index) {
      setVerificationResult("Correct! Mental model repaired. Profile updated.");
      refreshProfile();
    } else {
      setVerificationResult("Not quite — review the Scientific Reality section above and try again.");
    }
  };

  const activeInsight = insight ?? profile?.recent_misconceptions[0];

  // Consolidated 5 Navigation Tabs (PDF and YouTube unified into My Materials)
  const navItems = ["Overview", "My materials", "Study notes", "Practice", "Learning profile"];

  const loadVisual = async () => {
    if (!documentId) return setStatus("Please select or upload material first.");
    setVisualBusy(true);
    setStatus("Generating concept map...");
    try {
      const isYt = documentId.startsWith("yt-");
      const v = await generateVisual(documentId, isYt);
      setVisual(v);
      setStatus("Concept map generated!");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not generate visual.");
    } finally {
      setVisualBusy(false);
    }
  };

  const loadStyleExplanation = async () => {
    if (!documentId || !explainTopic.trim()) return;
    setExplainBusy(true);
    setStatus(`Generating ${explainStyle} explanation...`);
    try {
      const isYt = documentId.startsWith("yt-");
      const res = await explainInStyle(documentId, explainTopic, explainStyle, isYt);
      setStyleExplanation(res);
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not generate explanation.");
    } finally {
      setExplainBusy(false);
    }
  };

  const handleYoutubeIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setYoutubeBusy(true);
    setStatus("Fetching YouTube transcript and indexing...");
    try {
      const result = await ingestYoutube(youtubeUrl);
      setDocumentId(result.document_id);
      setDocumentName(result.title);
      setAnswer(undefined);
      setNotes(undefined);
      setQuiz(undefined);
      setVisual(undefined);
      setStyleExplanation(undefined);
      setStatus(`✓ YouTube video "${result.title}" indexed and ready for study.`);
      setYoutubeUrl("");
      refreshDocumentList();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to ingest YouTube video.");
    } finally {
      setYoutubeBusy(false);
    }
  };

  const allQuestionsAnswered = quiz && submittedIndexes.size === quiz.questions.length;
  const quizScore = quizResults.filter((r) => r?.correct).length;

  return (
    <main className="shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◉</span> LearnSphere
        </div>
        <p className="workspace">MY LEARNING SPACE</p>
        {navItems.map((item) => (
          <button
            key={item}
            className={nav === item ? "nav active" : "nav"}
            onClick={() => setNav(item)}
          >
            <span>◇</span>
            {item}
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="tiny-avatar">AR</div>
          <div>
            <b>Alex Rivera</b>
            <small>Student Learner</small>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="content">
        <header>
          <div>
            <p className="eyebrow">AI LEARNING COMPANION</p>
            <h1>{nav === "Overview" ? "Your understanding, live" : nav}</h1>
            <p className="subhead">Every interaction updates what LearnSphere believes you know.</p>
            {status && <p className="upload-message" role="status">{status}</p>}
          </div>
          <div>
            <input
              ref={fileInput}
              className="file-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }}
            />
            <button
              className="upload"
              disabled={busy}
              onClick={triggerGlobalUpload}
            >
              {busy ? "Uploading..." : "+ Upload PDF"}
            </button>
          </div>
        </header>

        {/* Global Active Material Context Bar */}
        {documentName && (
          <div
            style={{
              background: "#f0efff",
              border: "1px solid #dcd7fe",
              borderRadius: "10px",
              padding: "10px 16px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "16px" }}>{documentId?.startsWith("yt-") ? "📺" : "📄"}</span>
              <div>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "#564ad9", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  ACTIVE MATERIAL
                </span>
                <p style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: "700", color: "#202236" }}>
                  {documentName}
                </p>
              </div>
            </div>
            <button
              className="text-button"
              style={{ fontSize: "12px" }}
              onClick={() => setNav("My materials")}
            >
              Switch material →
            </button>
          </div>
        )}

        {/* Processing Banner */}
        {docDetails?.status === "processing" && (
          <div
            style={{
              background: "linear-gradient(90deg, #f0efff, #e8f4ff)",
              border: "1px solid #c5bdfc",
              borderRadius: "12px",
              padding: "14px 20px",
              marginBottom: "22px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "22px", display: "inline-block" }}>⚙️</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "13px", color: "#3730a3" }}>
                Indexing {documentName}...
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6366f1" }}>
                Extracting text and generating vector embeddings into ChromaDB...
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {nav === "Overview" && (
          <>
            <div className="top-grid">
              <Card className="profile-card">
                <div>
                  <p className="eyebrow">YOUR LEARNING PROFILE</p>
                  <h2>
                    {profile?.topics.length ? "Learning from your answers" : "Ready to learn you"}
                  </h2>
                  <p className="muted">
                    {profile?.total_attempts
                      ? `${profile.total_attempts} recorded diagnostic attempts`
                      : "Upload material, then take a diagnostic quiz."}
                  </p>
                </div>
                <Ring value={profile?.overall_mastery ?? 68} />
              </Card>

              <Card className="next-card">
                <p className="eyebrow">QUICK ACTION</p>
                <h3>
                  {documentName ? `${documentName}` : "Select or Upload Study Material"}
                </h3>
                <p className="muted">
                  {documentName
                    ? "Material ready. Open Study Notes, Practice, or Concept Maps."
                    : "Upload a PDF or paste a YouTube URL to extract text and generate AI study tools."}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    if (documentName) {
                      setNav("Study notes");
                    } else {
                      setNav("My materials");
                    }
                  }}
                >
                  {documentName ? "Open Study Workspace" : "Add Material"} <span>→</span>
                </button>
              </Card>
            </div>

            {/* Section Heading & Chart */}
            <div className="section-heading">
              <div>
                <h2>Topic mastery</h2>
                <p>Calculated from correctness and confidence alignment, not time spent.</p>
              </div>
            </div>

            <Card className="mastery">
              <div className="chart">
                {profile?.topics.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={profile.topics}
                      margin={{ top: 10, right: 0, left: -22, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="topic"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "#7b8195" }}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#7b8195" }} />
                      <Tooltip />
                      <Bar
                        dataKey="mastery"
                        fill="#695cf6"
                        radius={[6, 6, 0, 0]}
                        barSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted">
                    No mastery data yet. Upload material and complete a diagnostic quiz.
                  </p>
                )}
              </div>
            </Card>

            {/* AI Misconception Detector */}
            {activeInsight && (
              <Card className="insight">
                <div className="insight-icon">💡</div>
                <div className="insight-copy">
                  <p className="eyebrow">AI MISCONCEPTION DETECTED</p>
                  <h2>
                    <em>{activeInsight.label}</em>
                  </h2>
                  <p>{activeInsight.why}</p>
                  <button
                    className="text-button"
                    onClick={() => setActiveRepairModal(activeInsight)}
                  >
                    Repair this mental model →
                  </button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* TAB 2: MY MATERIALS (Unified PDF + YouTube Ingest Hub) */}
        {nav === "My materials" && (
          <div>
            <Card className="ask">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Add Learning Material</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#747789" }}>Index PDF textbooks or YouTube video transcripts into ChromaDB vector store.</p>
                </div>
                <div style={{ display: "flex", gap: "6px", background: "#f0efff", padding: "4px", borderRadius: "8px" }}>
                  <button
                    className={ingestMode === "pdf" ? "primary" : "text-button"}
                    style={{ padding: "6px 14px", fontSize: "12px" }}
                    onClick={() => setIngestMode("pdf")}
                  >
                    📄 PDF Document
                  </button>
                  <button
                    className={ingestMode === "youtube" ? "primary" : "text-button"}
                    style={{ padding: "6px 14px", fontSize: "12px" }}
                    onClick={() => setIngestMode("youtube")}
                  >
                    📺 YouTube Video
                  </button>
                </div>
              </div>

              {ingestMode === "pdf" ? (
                <div
                  style={{
                    border: `2px dashed ${isDragOver ? "#6255ef" : "#d9d6f8"}`,
                    borderRadius: "12px",
                    padding: "36px 20px",
                    textAlign: "center",
                    background: isDragOver ? "#f0efff" : "#f9f8fe",
                    cursor: "pointer",
                    marginTop: "12px",
                    transition: "all 0.18s ease",
                  }}
                  onClick={triggerGlobalUpload}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                    {isDragOver ? "📂" : "📄"}
                  </div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "16px", color: isDragOver ? "#6255ef" : "#564ad9", fontWeight: "700" }}>
                    {busy ? "Processing PDF document..." : isDragOver ? "Drop to upload!" : "Click to select or drag & drop a PDF file"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#85889a" }}>
                    Supports text-based PDF documents up to 20MB
                  </p>
                </div>
              ) : (
                <form onSubmit={handleYoutubeIngest} style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                  <input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="Paste YouTube video URL (e.g. https://www.youtube.com/watch?v=...)"
                    style={{ flex: 1, minWidth: "260px", padding: "11px 16px", borderRadius: "9px", border: "1px solid #dcd7fe", fontSize: "14px", background: "#fafafa", outline: "none" }}
                  />
                  <button className="primary" type="submit" disabled={youtubeBusy || !youtubeUrl.trim()}>
                    {youtubeBusy ? "Indexing..." : "Index Video"} ↑
                  </button>
                </form>
              )}
            </Card>

            {/* Document History & Materials List */}
            {documentList.length > 0 && (
              <Card className="ask" style={{ marginTop: "18px" }}>
                <h3>All Indexed Materials</h3>
                <p>Select any material to set it as your active study context.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  {documentList.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 16px",
                        background: documentId === doc.id ? "#f0efff" : "#f8f8fd",
                        border: `1px solid ${documentId === doc.id ? "#c5bdfc" : "#e5e5f0"}`,
                        borderRadius: "10px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#202236", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.id.startsWith("yt-") ? "📺" : "📄"} {doc.filename}
                          </span>
                          <StatusBadge status={doc.status} />
                          {documentId === doc.id && (
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#564ad9", background: "#e9e7ff", padding: "2px 7px", borderRadius: "20px" }}>
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "#85889a" }}>
                          {doc.status === "ready"
                            ? `${doc.page_count} page(s) · ${doc.chunk_count} chunk(s)`
                            : doc.status === "failed"
                            ? "Processing failed"
                            : "Processing..."}
                        </p>
                      </div>
                      {doc.status === "ready" && documentId !== doc.id && (
                        <button
                          className="primary"
                          style={{ marginLeft: "12px", flexShrink: 0, padding: "8px 14px", fontSize: "12px" }}
                          onClick={() => activateDocument(doc)}
                        >
                          Study this →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB 3: STUDY NOTES */}
        {nav === "Study notes" && (
          <>
            {!documentId ? (
              <EmptyDocumentState onAction={() => setNav("My materials")} />
            ) : (
              <>
                <Card className="ask">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h3>AI Summary & Grounded Study Notes</h3>
                      <p>Executive overview, key concepts dictionary, and grounded study notes from <strong>{documentName}</strong>.</p>
                    </div>
                    <button className="primary" disabled={busy} onClick={loadNotes}>
                      {notes ? "Regenerate Notes" : "Generate Notes"}
                    </button>
                  </div>

                  {notes && (
                    <div className="study-answer" style={{ marginTop: "20px" }}>
                      <b>EXECUTIVE SUMMARY</b>
                      <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#202236", fontWeight: "500" }}>
                        {notes.summary || "Summary generated from indexed source material."}
                      </p>

                      {notes.key_concepts && notes.key_concepts.length > 0 && (
                        <>
                          <b style={{ marginTop: "18px" }}>KEY CONCEPTS & DEFINITIONS</b>
                          <div className="concepts-grid">
                            {notes.key_concepts.map((kc, idx) => (
                              <div key={idx} className="concept-card">
                                <h4>{kc.term}</h4>
                                <p>{kc.definition}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <b style={{ marginTop: "20px" }}>GROUNDED STUDY NOTES</b>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.65", color: "#34374c", fontSize: "13.5px" }}>
                        {notes.notes}
                      </div>

                      {notes.citations && notes.citations.length > 0 && (
                        <>
                          <b style={{ marginTop: "18px" }}>SOURCE CITATIONS & PROVENANCE</b>
                          <div className="citations">
                            {notes.citations.map((c) => (
                              <span key={c.chunk_id}>Source · Page {c.page_number}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Card>

                {/* Shared Concept Map Component */}
                <ConceptMapCard
                  title={visual?.title}
                  mermaidCode={visual?.mermaid_code}
                  conceptNodes={visual?.concept_nodes}
                  busy={visualBusy}
                  onGenerate={loadVisual}
                  buttonText="Generate Concept Map"
                />

                {/* Explain in Different Styles Panel */}
                <Card className="ask" style={{ marginTop: "18px" }}>
                  <h3>🎨 Explain in Different Styles</h3>
                  <p>Re-explain any topic from your document in a learning style that works for you — from beginner-friendly to code analogies.</p>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "12px" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#564ad9", textTransform: "uppercase", letterSpacing: "0.6px", display: "block", marginBottom: "6px" }}>TOPIC TO EXPLAIN</label>
                      <input
                        value={explainTopic}
                        onChange={(e) => setExplainTopic(e.target.value)}
                        placeholder="e.g. Key principles in material"
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", background: "#fafafa", outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#564ad9", textTransform: "uppercase", letterSpacing: "0.6px", display: "block", marginBottom: "6px" }}>STYLE</label>
                      <select
                        value={explainStyle}
                        onChange={(e) => setExplainStyle(e.target.value as ExplainStyle)}
                        style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "13px", background: "#fafafa", cursor: "pointer", outline: "none" }}
                      >
                        {(["beginner", "visual", "programmer", "researcher", "story", "interview"] as ExplainStyle[]).map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="primary"
                      disabled={explainBusy || !explainTopic.trim()}
                      onClick={loadStyleExplanation}
                    >
                      {explainBusy ? "Generating..." : "Explain"} →
                    </button>
                  </div>
                  {styleExplanation && (
                    <div className="study-answer" style={{ marginTop: "20px" }}>
                      <b style={{ fontSize: "11px", letterSpacing: "0.6px" }}>
                        {styleExplanation.style.toUpperCase()} EXPLANATION — {styleExplanation.topic}
                      </b>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.7", color: "#34374c", fontSize: "13.5px", marginTop: "10px" }}>
                        {styleExplanation.content}
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </>
        )}

        {/* TAB 4: PRACTICE */}
        {nav === "Practice" && (
          <>
            {!documentId ? (
              <EmptyDocumentState onAction={() => setNav("My materials")} />
            ) : (
              <Card className="ask">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h3>Diagnostic practice</h3>
                    <p>Questions target reasoning and misconceptions to update your Learning Profile.</p>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button className="primary" disabled={busy} onClick={() => startQuiz("adaptive")}>
                      ⚡ Start Adaptive Quiz
                    </button>
                    <button className="text-button" disabled={busy} onClick={() => startQuiz("standard")} style={{ fontSize: "13px" }}>
                      Standard Mode
                    </button>
                  </div>
                </div>

                {/* Quiz completed summary */}
                {quiz && allQuestionsAnswered && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "20px 24px",
                      background: "linear-gradient(120deg, #f0efff, #f0fff4)",
                      border: "1px solid #c5bdfc",
                      borderRadius: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>
                      {quizScore === quiz.questions.length ? "🎉" : quizScore >= quiz.questions.length / 2 ? "👍" : "📚"}
                    </div>
                    <h3 style={{ color: "#202236", marginBottom: "6px" }}>
                      Quiz complete! {quizScore}/{quiz.questions.length} correct
                    </h3>
                    <p style={{ color: "#666a7c", fontSize: "13px", margin: 0 }}>
                      {quizScore === quiz.questions.length
                        ? "Excellent! Perfect score — your mastery is rising."
                        : quizScore >= quiz.questions.length / 2
                        ? "Good effort! Review the incorrect answers in your Learning Profile."
                        : "Keep practicing — your profile will adapt to help you improve."}
                    </p>
                    <button
                      className="primary"
                      style={{ marginTop: "16px" }}
                      onClick={() => startQuiz("adaptive")}
                      disabled={busy}
                    >
                      Try a new adaptive quiz →
                    </button>
                  </div>
                )}

                {/* Active question */}
                {quiz?.questions[currentQuestionIndex] && !allQuestionsAnswered && (
                  <div className="study-answer">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <b>QUESTION {currentQuestionIndex + 1} OF {quiz.questions.length}</b>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {quiz.questions.map((_, i) => (
                          <div
                            key={i}
                            style={{
                              width: "28px",
                              height: "6px",
                              borderRadius: "3px",
                              background: submittedIndexes.has(i)
                                ? (quizResults[i]?.correct ? "#22c55e" : "#ef4444")
                                : i === currentQuestionIndex
                                ? "#6255ef"
                                : "#e5e5f0",
                              transition: "background 0.2s ease",
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <p style={{ fontSize: "14px", fontWeight: "600", color: "#202236" }}>
                      {quiz.questions[currentQuestionIndex].question}
                    </p>

                    {quiz.questions[currentQuestionIndex].choices.map((choice, index) => {
                      const isSubmitted = submittedIndexes.has(currentQuestionIndex);
                      const thisResult = quizResults[currentQuestionIndex];
                      const correctIdx = quiz.questions[currentQuestionIndex].answer_index;
                      let extraStyle: React.CSSProperties = {};
                      if (isSubmitted) {
                        if (index === correctIdx) extraStyle = { background: "#f0fff4", borderColor: "#22c55e", color: "#15803d" };
                        else if (index === thisResult?.choice && !thisResult?.correct) extraStyle = { background: "#fff5f5", borderColor: "#ef4444", color: "#b91c1c" };
                      }
                      return (
                        <button
                          key={choice}
                          className={selectedChoice === index && !isSubmitted ? "choice selected" : "choice"}
                          style={extraStyle}
                          onClick={() => !isSubmitted && setSelectedChoice(index)}
                          disabled={isSubmitted}
                        >
                          {choice}
                        </button>
                      );
                    })}

                    {submittedIndexes.has(currentQuestionIndex) && (
                      <div style={{ marginTop: "12px", padding: "12px 16px", background: "#f7f6ff", borderRadius: "9px", fontSize: "13px", color: "#565a6d" }}>
                        <strong style={{ color: "#564ad9", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase" }}>Explanation</strong>
                        <p style={{ margin: "6px 0 0" }}>{quiz.questions[currentQuestionIndex].explanation}</p>
                      </div>
                    )}

                    <p className="eyebrow" style={{ marginTop: "16px" }}>
                      HOW CONFIDENT ARE YOU IN THIS REASONING?
                    </p>
                    <div className="confidence-selector">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          className={confidence === lvl ? "confidence-btn active" : "confidence-btn"}
                          onClick={() => setConfidence(lvl)}
                          disabled={submittedIndexes.has(currentQuestionIndex)}
                        >
                          {lvl === 1 ? "1 (Guess)" : lvl === 5 ? "5 (Certain)" : `${lvl}`}
                        </button>
                      ))}
                    </div>

                    {!submittedIndexes.has(currentQuestionIndex) ? (
                      <button
                        className="primary submit-attempt"
                        disabled={busy || selectedChoice === undefined}
                        onClick={submitQuizAttempt}
                      >
                        Check my reasoning
                      </button>
                    ) : currentQuestionIndex < quiz.questions.length - 1 ? (
                      <button
                        className="primary submit-attempt"
                        onClick={goToNextQuestion}
                      >
                        Next Question → ({currentQuestionIndex + 2} of {quiz.questions.length})
                      </button>
                    ) : null}
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {/* TAB 5: LEARNING PROFILE */}
        {nav === "Learning profile" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "17px" }}>
              <Card className="profile-card">
                <div>
                  <p className="eyebrow">OVERALL MASTERY</p>
                  <h2>{profile?.overall_mastery ?? 0}%</h2>
                  <p className="muted">Weighted accuracy + confidence score</p>
                </div>
                <Ring value={profile?.overall_mastery ?? 0} label="mastery" />
              </Card>

              <Card className="profile-card">
                <div>
                  <p className="eyebrow">CONFIDENCE ALIGNMENT</p>
                  <h2>{profile?.confidence_alignment ?? 85}%</h2>
                  <p className="muted">How accurately confidence matches correctness</p>
                </div>
                <Ring value={profile?.confidence_alignment ?? 85} label="calibrated" />
              </Card>

              <Card className="profile-card">
                <div>
                  <p className="eyebrow">ACCURACY RATE</p>
                  <h2>{profile?.accuracy_rate ?? 0}%</h2>
                  <p className="muted">{profile?.total_attempts ?? 0} total quiz attempts recorded</p>
                </div>
                <Ring value={profile?.accuracy_rate ?? 0} label="accuracy" />
              </Card>
            </div>

            {/* Recent Misconceptions */}
            {profile?.recent_misconceptions && profile.recent_misconceptions.length > 0 && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Recent misconceptions</h2>
                    <p>AI-detected knowledge gaps from your quiz attempts.</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {profile.recent_misconceptions.map((m) => (
                    <Card key={m.id} className="ask" style={{ marginTop: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <p className="eyebrow" style={{ color: "#e53e3e" }}>{m.topic}</p>
                          <h3 style={{ margin: "2px 0 6px", color: "#202236" }}>{m.label}</h3>
                          <p style={{ margin: 0, fontSize: "13px", color: "#666a7c", lineHeight: "1.5" }}>{m.why}</p>
                          <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#9396a6" }}>{m.created_at}</p>
                        </div>
                        <button
                          className="primary"
                          style={{ marginLeft: "16px", flexShrink: 0, padding: "8px 14px", fontSize: "12px" }}
                          onClick={() => {
                            setActiveRepairModal(m);
                            setVerificationChoice(undefined);
                            setVerificationResult("");
                          }}
                        >
                          Repair →
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Attempt History */}
            {profile?.attempt_history && profile.attempt_history.length > 0 && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Attempt history</h2>
                    <p>Your last {Math.min(profile.attempt_history.length, 30)} diagnostic quiz attempts.</p>
                  </div>
                </div>
                <Card className="ask">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #eeeef3" }}>
                          <th style={{ textAlign: "left", padding: "8px 10px", color: "#9294a6", fontWeight: 700, fontSize: "10px", letterSpacing: "0.8px", textTransform: "uppercase" }}>TOPIC</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", color: "#9294a6", fontWeight: 700, fontSize: "10px", letterSpacing: "0.8px", textTransform: "uppercase" }}>RESULT</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", color: "#9294a6", fontWeight: 700, fontSize: "10px", letterSpacing: "0.8px", textTransform: "uppercase" }}>CONFIDENCE</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", color: "#9294a6", fontWeight: 700, fontSize: "10px", letterSpacing: "0.8px", textTransform: "uppercase" }}>TIME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.attempt_history.map((a) => (
                          <tr key={a.id} style={{ borderBottom: "1px solid #f2f2f6" }}>
                            <td style={{ padding: "10px", color: "#34374c", fontWeight: 600, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.topic}</td>
                            <td style={{ padding: "10px" }}>
                              <span style={{
                                background: a.is_correct ? "#d1fae5" : "#fee2e2",
                                color: a.is_correct ? "#065f46" : "#991b1b",
                                padding: "2px 8px",
                                borderRadius: "20px",
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase"
                              }}>
                                {a.is_correct ? "Correct" : "Incorrect"}
                              </span>
                            </td>
                            <td style={{ padding: "10px" }}>
                              <div style={{ display: "flex", gap: "3px" }}>
                                {[1,2,3,4,5].map(n => (
                                  <div key={n} style={{ width: "6px", height: "6px", borderRadius: "50%", background: n <= a.confidence ? "#6255ef" : "#e5e5f0" }} />
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: "10px", color: "#9294a6" }}>{a.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {!profile?.attempt_history?.length && !profile?.topics?.length && (
              <Card className="ask" style={{ marginTop: "18px", textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📊</div>
                <h3 style={{ color: "#202236" }}>Your learning profile is ready</h3>
                <p style={{ color: "#85889a", maxWidth: "380px", margin: "0 auto 16px" }}>
                  Upload material and complete a diagnostic quiz to start building your personalized learning profile.
                </p>
                <button className="primary" onClick={() => setNav("Practice")}>
                  Start a diagnostic quiz →
                </button>
              </Card>
            )}
          </div>
        )}

        {/* Unified RAG Grounded Chat Companion */}
        <Card className="ask" style={{ marginTop: "24px" }}>
          <div>
            <h3>Ask about your material</h3>
            <p>{documentId ? `Grounded in "${documentName}". Source citations included.` : "Upload material to ask grounded questions."}</p>
          </div>
          <form onSubmit={ask}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={documentId ? `Ask LearnSphere about "${documentName}"…` : "Upload material to start asking questions..."}
            />
            <button disabled={busy || !documentId} aria-label="Send question">
              ↑
            </button>
          </form>
          {answer && (
            <div className="study-answer">
              <b>LEARNSPHERE COMPANION</b>
              <p>{answer.answer}</p>
              <div className="citations">
                {answer.citations?.map((c) => (
                  <span key={c.chunk_id}>Source · p. {c.page_number}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* MISCONCEPTION REPAIR MODAL */}
      {activeRepairModal && (
        <div className="modal-backdrop" onClick={() => setActiveRepairModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setActiveRepairModal(null)}>
              ×
            </button>
            <p className="eyebrow" style={{ color: "#6255ef" }}>
              AI MISCONCEPTION REPAIR
            </p>
            <h2>{activeRepairModal.label}</h2>
            <p>{activeRepairModal.why}</p>

            <div className="comparison-grid">
              <div className="intuition-box">
                <span>COMMON INTUITION</span>
                <p>{activeRepairModal.common_intuition}</p>
              </div>
              <div className="reality-box">
                <span>SCIENTIFIC REALITY</span>
                <p>{activeRepairModal.scientific_reality}</p>
              </div>
            </div>

            <div className="answer">
              <span>KEY CONCEPT CORRECTION</span>
              <q>{activeRepairModal.correction}</q>
            </div>

            <div className="check">
              <span>VERIFICATION CHECK</span>
              <b>{activeRepairModal.verification_check}</b>

              {activeRepairModal.verification_options?.map((opt, i) => (
                <button
                  key={opt}
                  className={verificationChoice === i ? "choice selected" : "choice"}
                  onClick={() => setVerificationChoice(i)}
                  style={{ background: "#fff", marginTop: "6px" }}
                >
                  {opt}
                </button>
              ))}

              <button
                className="primary"
                style={{ marginTop: "10px", width: "100%" }}
                disabled={verificationChoice === undefined}
                onClick={handleVerificationCheck}
              >
                Verify repaired understanding
              </button>

              {verificationResult && (
                <p
                  style={{
                    marginTop: "10px",
                    fontWeight: "600",
                    color: verificationResult.includes("Correct") ? "#249a63" : "#e53e3e",
                    fontSize: "12.5px",
                  }}
                >
                  {verificationResult}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
