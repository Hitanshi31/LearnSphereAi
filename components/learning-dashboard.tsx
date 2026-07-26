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
  repairMisconception,
  submitAttempt,
  getAudioNarration,
  initiateXRayDiagnose,
  submitXRayProbe,
  verifyOriginalConceptXRay,
  getReadinessXRay,
  type AudioNarration,
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
  type XRayDiagnosisResponse,
  type XRayProbeResponse,
  type XRayReturnVerifyResponse,
  type ReadinessReportResponse,
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

function FormattedSummary({ summary, onSpeak, isSpeaking }: { summary: string; onSpeak?: () => void; isSpeaking?: boolean }) {
  if (!summary) return null;

  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  const overviewText = lines.filter((l) => !l.startsWith("•") && !l.startsWith("-")).join(" ");
  const bulletItems = lines
    .filter((l) => l.startsWith("•") || l.startsWith("-"))
    .map((l) => l.replace(/^[-•]\s*/, ""));

  return (
    <div style={{ background: "#f0efff", border: "1px solid #dcd7fe", borderRadius: "10px", padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <b style={{ color: "#564ad9", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase" }}>
          EXECUTIVE SUMMARY (Hugging Face AI)
        </b>
        {onSpeak && (
          <button
            onClick={onSpeak}
            style={{
              background: isSpeaking ? "#fee2e2" : "#ffffff",
              color: isSpeaking ? "#991b1b" : "#564ad9",
              border: "1px solid #dcd7fe",
              borderRadius: "20px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {isSpeaking ? "⏹️ Stop Audio" : "🔊 Listen"}
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: "#202236", fontWeight: "500" }}>
        {overviewText}
      </p>

      {bulletItems.length > 0 && (
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <b style={{ color: "#564ad9", fontSize: "10px", letterSpacing: "0.6px", textTransform: "uppercase" }}>KEY TAKEAWAYS</b>
          {bulletItems.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px", color: "#34374c", lineHeight: "1.5" }}>
              <span style={{ color: "#6255ef", fontWeight: "bold" }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormattedNotes({ content }: { content: string }) {
  if (!content) return null;

  const sections = content.split(/(?=###\s+)/);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
      {sections.map((section, idx) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        const headerMatch = trimmed.match(/^###\s+(.+)$/m);
        const rawHeader = headerMatch ? headerMatch[1].trim() : null;
        const icon = rawHeader ? (rawHeader.match(/^[^\w\s]+/)?.[0] || '📌') : '📌';
        const headerTitle = rawHeader ? rawHeader.replace(/^[^\w\s]+\s*/, '') : null;

        const bodyText = rawHeader ? trimmed.replace(/^###\s+.+$/m, '').trim() : trimmed;
        const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

        return (
          <div key={idx} style={{ background: "#f8f8fd", border: "1px solid #e5e5f0", borderRadius: "10px", padding: "16px 18px" }}>
            {headerTitle && (
              <h4 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: "700", color: "#564ad9", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{icon}</span> {headerTitle}
              </h4>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {lines.map((line, lIdx) => {
                const isBullet = line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ");
                const cleanLine = isBullet ? line.replace(/^[-•*]\s+/, '') : line;
                const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

                return (
                  <div key={lIdx} style={{ display: "flex", gap: isBullet ? "8px" : "0", alignItems: "flex-start", fontSize: "13px", color: "#34374c", lineHeight: "1.5" }}>
                    {isBullet && <span style={{ color: "#6255ef", fontWeight: "bold" }}>•</span>}
                    <div>
                      {parts.map((p, pIdx) => {
                        if (p.startsWith("**") && p.endsWith("**")) {
                          return <strong key={pIdx} style={{ color: "#202236" }}>{p.slice(2, -2)}</strong>;
                        }
                        return p;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
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
  nodeDiagnosticStates,
  busy,
  onGenerate,
  buttonText = "Generate Concept Map",
  onSelectTopic,
  onAskQuestion,
}: {
  title?: string;
  mermaidCode?: string;
  conceptNodes?: ConceptNode[];
  nodeDiagnosticStates?: Record<string, string>;
  busy: boolean;
  onGenerate: () => void;
  buttonText?: string;
  onSelectTopic?: (topic: string) => void;
  onAskQuestion?: (question: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);

  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;

    setRenderError(false);
    const container = containerRef.current;
    const renderId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

    let attempts = 0;
    const attemptRender = async () => {
      // @ts-ignore
      const mermaid = typeof window !== "undefined" ? (window as any).mermaid : null;
      if (!mermaid) {
        attempts++;
        if (attempts < 15) {
          setTimeout(attemptRender, 200);
        }
        return;
      }

      try {
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
        let cleanCode = mermaidCode.trim();
        if (!cleanCode.startsWith("graph TD") && !cleanCode.startsWith("graph LR") && !cleanCode.startsWith("flowchart")) {
          cleanCode = `graph TD\n${cleanCode}`;
        }

        const { svg } = await mermaid.render(renderId, cleanCode);
        if (container) {
          container.innerHTML = svg;
        }
      } catch (err) {
        console.warn("Mermaid render error:", err);
        setRenderError(true);
      }
    };

    attemptRender();
  }, [mermaidCode]);

  return (
    <Card className="ask" style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ margin: 0 }}>🗺️ Visual Concept Map & Knowledge X-Ray</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#747789" }}>Interactive flowchart mapping key concepts, directed prerequisite dependencies, and live X-Ray diagnostic states.</p>
        </div>
        <button className="primary" disabled={busy} onClick={onGenerate}>
          {busy ? "Generating map..." : mermaidCode ? "Regenerate Concept Map" : buttonText}
        </button>
      </div>

      {mermaidCode && (
        <div style={{ marginTop: "20px" }}>
          <b style={{ color: "#564ad9", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            {title || "Concept Map"}
          </b>

          {!renderError ? (
            <div
              ref={containerRef}
              style={{
                marginTop: "12px",
                padding: "20px",
                background: "#f7f6ff",
                borderRadius: "12px",
                border: "1px solid #dcd7fe",
                overflowX: "auto",
                textAlign: "center",
              }}
            />
          ) : (
            <div style={{ marginTop: "12px", padding: "16px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", fontSize: "13px", color: "#991b1b" }}>
              Graph rendering in progress. Concept nodes and relationships are listed below:
            </div>
          )}

          {conceptNodes && conceptNodes.length > 0 && (
            <>
              <b style={{ marginTop: "18px", display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px", color: "#564ad9" }}>
                INTERACTIVE CONCEPT NODES — CLICK TO DRILL DOWN
              </b>
              <div className="concepts-grid" style={{ marginTop: "10px" }}>
                {conceptNodes.map((node, idx) => {
                  const isSelected = selectedNode?.label === node.label;
                  const diagState = nodeDiagnosticStates?.[node.label] || node.diagnostic_state || "normal";
                  
                  const stateStyles: Record<string, React.CSSProperties> = {
                    investigating: { border: "2px solid #6255ef", background: "#f0efff" },
                    suspected: { border: "2px solid #d97706", background: "#fef3c7" },
                    ruled_out: { border: "1px solid #e5e5f0", opacity: 0.65 },
                    confirmed_root_gap: { border: "2px solid #dc2626", background: "#fee2e2" },
                    repaired: { border: "2px solid #059669", background: "#d1fae5" },
                    normal: {},
                  };

                  const stateBadges: Record<string, { label: string; bg: string; color: string }> = {
                    investigating: { label: "🔍 INVESTIGATING", bg: "#e0e7ff", color: "#3730a3" },
                    suspected: { label: "⚡ SUSPECTED ROOT GAP", bg: "#fef3c7", color: "#92400e" },
                    ruled_out: { label: "✓ INTACT", bg: "#e5e7eb", color: "#4b5563" },
                    confirmed_root_gap: { label: "🔴 CONFIRMED ROOT GAP", bg: "#fee2e2", color: "#991b1b" },
                    repaired: { label: "✓ REPAIRED", bg: "#d1fae5", color: "#065f46" },
                    normal: { label: node.type, bg: "#f0efff", color: "#564ad9" },
                  };

                  const currentBadge = stateBadges[diagState] || stateBadges.normal;
                  const currentStyle = stateStyles[diagState] || {};

                  return (
                    <div
                      key={node.id || idx}
                      className={`concept-card-interactive ${isSelected ? "active-node" : ""}`}
                      style={{
                        ...currentStyle,
                        borderLeft: `4px solid ${
                          diagState === "confirmed_root_gap" ? "#dc2626" :
                          diagState === "suspected" ? "#d97706" :
                          diagState === "repaired" ? "#059669" :
                          node.type === "core" ? "#6255ef" : node.type === "process" ? "#f59e0b" : node.type === "outcome" ? "#22c55e" : "#8b5cf6"
                        }`,
                      }}
                      onClick={() => setSelectedNode(isSelected ? null : node)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <h4 style={{ margin: 0, fontSize: "13px", color: "#202236" }}>{node.label}</h4>
                        <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "10px", background: currentBadge.bg, color: currentBadge.color, textTransform: "uppercase" }}>
                          {currentBadge.label}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#52566b", lineHeight: "1.45" }}>{node.summary}</p>
                      {isSelected && (
                        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #e5e5f0", display: "flex", gap: "6px", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                          {onSelectTopic && (
                            <button
                              className="sample-pill"
                              onClick={() => onSelectTopic(node.label)}
                            >
                              🎨 Explain in My Style
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
  const [isChatOpen, setIsChatOpen] = useState(false);
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

  // Audio & Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [audioNarration, setAudioNarration] = useState<AudioNarration | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Knowledge X-Ray state
  const [xrayDiagnosis, setXRayDiagnosis] = useState<XRayDiagnosisResponse | null>(null);
  const [activeXRayModal, setActiveXRayModal] = useState<XRayDiagnosisResponse | null>(null);
  const [probeChoice, setProbeChoice] = useState<number | undefined>(undefined);
  const [probeResult, setProbeResult] = useState<XRayProbeResponse | null>(null);
  const [retestChoice, setRetestChoice] = useState<number | undefined>(undefined);
  const [retestResult, setRetestResult] = useState<XRayReturnVerifyResponse | null>(null);
  const [readinessReport, setReadinessReport] = useState<ReadinessReportResponse | null>(null);
  const [xrayBusy, setXRayBusy] = useState(false);

  const runXRayInvestigation = async (failedConcept: string, qText = "", ansText = "") => {
    if (!documentId) return;
    setXRayBusy(true);
    try {
      const diag = await initiateXRayDiagnose(documentId, failedConcept, qText, ansText, learnerId);
      setXRayDiagnosis(diag);
      setActiveXRayModal(diag);
      setProbeChoice(undefined);
      setProbeResult(null);
      setRetestChoice(undefined);
      setRetestResult(null);
    } catch (err) {
      console.warn("X-Ray diagnosis notice:", err);
      setStatus("Knowledge X-Ray requires an active document context.");
    } finally {
      setXRayBusy(false);
    }
  };

  const handleProbeSubmit = async () => {
    if (!documentId || !activeXRayModal || probeChoice === undefined) return;
    setXRayBusy(true);
    try {
      const res = await submitXRayProbe(
        documentId,
        activeXRayModal.original_failed_concept,
        activeXRayModal.suspected_root_concept,
        probeChoice,
        activeXRayModal.probe_question?.choices[probeChoice] || "",
        learnerId
      );
      setProbeResult(res);
      if (res.root_gap_confirmed && res.repair_misconception) {
        setInsight(res.repair_misconception);
      }
    } catch (err) {
      console.warn("X-Ray probe notice:", err);
    } finally {
      setXRayBusy(false);
    }
  };

  const handleRetestSubmit = async () => {
    if (!documentId || !activeXRayModal || retestChoice === undefined) return;
    setXRayBusy(true);
    try {
      const res = await verifyOriginalConceptXRay(
        documentId,
        activeXRayModal.original_failed_concept,
        activeXRayModal.suspected_root_concept,
        retestChoice,
        "Selected retest choice",
        learnerId
      );
      setRetestResult(res);
      refreshProfile();
    } catch (err) {
      console.warn("X-Ray retest notice:", err);
    } finally {
      setXRayBusy(false);
    }
  };

  const loadReadinessScan = async (docId: string) => {
    try {
      const rep = await getReadinessXRay(docId, learnerId);
      setReadinessReport(rep);
    } catch (err) {
      console.warn("Readiness scan notice:", err);
    }
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-Speech is not supported in this browser environment.");
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#📌⚡•\-_]/g, " ").trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = speechRate;
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingText(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingText(null);
    };
    setIsSpeaking(true);
    setSpeakingText(text);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingText(null);
  };

  const toggleSpeech = (text: string) => {
    if (isSpeaking && speakingText === text) {
      stopSpeech();
    } else {
      speakText(text);
    }
  };

  const loadAudioNarration = async (docId: string) => {
    setAudioBusy(true);
    try {
      const data = await getAudioNarration(docId);
      setAudioNarration(data);
    } catch (err) {
      console.warn("Audio narration load notice:", err);
    } finally {
      setAudioBusy(false);
    }
  };

  const startVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please type your question.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuestion(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      console.warn("Voice input notice:", err);
      setIsListening(false);
    }
  };

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

  const handleVerificationCheck = async () => {
    if (!activeRepairModal || verificationChoice === undefined) return;
    if (verificationChoice === activeRepairModal.verification_correct_index) {
      setVerificationResult("✓ Correct! Mental model repaired and recorded in your Learning Profile.");
      try {
        const updated = await repairMisconception(activeRepairModal.id, learnerId);
        setProfile(updated);
      } catch {
        refreshProfile();
      }
    } else {
      setVerificationResult("Not quite — review the Scientific Reality section above and try again.");
    }
  };

  const activeInsight = insight ?? profile?.recent_misconceptions[0];
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

            {/* Grounded AI Q&A Search Bar with Sleek Mic Icon */}
            <Card className="ask" style={{ marginTop: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>💬 Ask LearnSphere AI</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#747789" }}>
                    Ask any question grounded in {documentName ? <strong>{documentName}</strong> : "your uploaded study material"}.
                  </p>
                </div>
              </div>

              <form onSubmit={ask} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={isListening ? "Listening... Speak your question now!" : "Ask anything about your study material..."}
                    style={{
                      width: "100%",
                      padding: "12px 50px 12px 16px",
                      borderRadius: "10px",
                      border: isListening ? "2px solid #ef4444" : "1px solid #dcd7fe",
                      fontSize: "14px",
                      background: isListening ? "#fff5f5" : "#fafafa",
                      outline: "none",
                      boxShadow: isListening ? "0 0 12px rgba(239, 68, 68, 0.3)" : "none",
                      transition: "all 0.2s ease"
                    }}
                  />
                  <button
                    type="button"
                    onClick={startVoiceInput}
                    title={isListening ? "Listening..." : "Speak question"}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: isListening ? "#ef4444" : "#f0efff",
                      color: isListening ? "#ffffff" : "#564ad9",
                      border: "none",
                      borderRadius: "50%",
                      width: "34px",
                      height: "34px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "15px",
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                      boxShadow: isListening ? "0 0 8px rgba(239, 68, 68, 0.5)" : "none",
                    }}
                  >
                    {isListening ? "🔴" : "🎙️"}
                  </button>
                </div>
                <button className="primary" type="submit" disabled={busy || !question.trim() || !documentId}>
                  {busy ? "Searching..." : "Ask AI"} →
                </button>
              </form>

              {answer && (
                <div className="study-answer" style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <b style={{ color: "#564ad9", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase" }}>
                      GROUNDED AI ANSWER
                    </b>
                    <button
                      className="sample-pill"
                      onClick={() => toggleSpeech(answer.answer)}
                      style={{ fontSize: "11px", padding: "3px 10px" }}
                    >
                      {isSpeaking && speakingText === answer.answer ? "⏹️ Stop" : "🔊 Listen"}
                    </button>
                  </div>
                  <div style={{ lineHeight: "1.6", color: "#34374c", fontSize: "14px" }}>
                    {answer.answer}
                  </div>
                  {answer.citations && answer.citations.length > 0 && (
                    <div className="citations" style={{ marginTop: "10px" }}>
                      {answer.citations.map((c) => (
                        <span key={c.chunk_id}>Source · Page {c.page_number}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

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

              {documentList.length > 0 && (
                <div style={{ margin: "10px 0 14px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#564ad9", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                    ⚡ QUICK DEMO MATERIALS:
                  </span>
                  {documentList.slice(0, 4).map((doc) => (
                    <button
                      key={doc.id}
                      className="sample-pill"
                      onClick={() => activateDocument(doc)}
                    >
                      {doc.id.startsWith("yt-") ? "📺" : "⚛️"} {doc.filename.replace(".pdf", "")}
                    </button>
                  ))}
                </div>
              )}

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
                    <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      {/* Audio Study Narration Bar */}
                      <div
                        style={{
                          background: "linear-gradient(135deg, #564ad9, #7c3aed)",
                          color: "#ffffff",
                          borderRadius: "12px",
                          padding: "16px 20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "12px",
                          boxShadow: "0 4px 14px rgba(86, 74, 217, 0.25)"
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85 }}>
                            🎧 AUDIO STUDY NARRATION (TEXT-TO-SPEECH)
                          </div>
                          <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
                            {audioNarration ? audioNarration.title : `Listen to ${documentName} Study Narration`}
                          </div>
                          <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>
                            {audioNarration ? `${audioNarration.total_sections} sections · ~${audioNarration.estimated_total_minutes} min duration` : "Full voice study narration for hands-free learning."}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <select
                            value={speechRate}
                            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", outline: "none", cursor: "pointer" }}
                          >
                            <option value="0.8" style={{ color: "#000" }}>0.8x Speed</option>
                            <option value="1.0" style={{ color: "#000" }}>1.0x Speed</option>
                            <option value="1.25" style={{ color: "#000" }}>1.25x Speed</option>
                            <option value="1.5" style={{ color: "#000" }}>1.5x Speed</option>
                          </select>
                          <button
                            onClick={() => {
                              if (!audioNarration && documentId) {
                                loadAudioNarration(documentId);
                              }
                              toggleSpeech(`${notes.summary}. ${notes.notes}`);
                            }}
                            style={{
                              background: isSpeaking ? "#ef4444" : "#ffffff",
                              color: isSpeaking ? "#ffffff" : "#564ad9",
                              border: "none",
                              borderRadius: "20px",
                              padding: "8px 18px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                            }}
                          >
                            {isSpeaking ? "⏹️ Stop Audio" : "▶️ Play Audio Guide"}
                          </button>
                        </div>
                      </div>

                      <FormattedSummary
                        summary={notes.summary}
                        onSpeak={() => toggleSpeech(notes.summary)}
                        isSpeaking={isSpeaking && speakingText === notes.summary}
                      />

                      {notes.key_concepts && notes.key_concepts.length > 0 && (
                        <div>
                          <b style={{ color: "#564ad9", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
                            KEY CONCEPTS & DEFINITIONS
                          </b>
                          <div className="concepts-grid">
                            {notes.key_concepts.map((kc, idx) => (
                              <div key={idx} className="concept-card">
                                <h4>{kc.term}</h4>
                                <p>{kc.definition}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <FormattedNotes content={notes.notes} />

                      {notes.citations && notes.citations.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <b style={{ color: "#564ad9", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                            SOURCE CITATIONS & PROVENANCE
                          </b>
                          <div className="citations">
                            {notes.citations.map((c) => (
                              <span key={c.chunk_id}>Source · Page {c.page_number}</span>
                            ))}
                          </div>
                        </div>
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
                  onSelectTopic={(topic) => setExplainTopic(topic)}
                  onAskQuestion={(q) => setQuestion(q)}
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

                    {submittedIndexes.has(currentQuestionIndex) && !quizResults[currentQuestionIndex]?.correct && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "14px 18px",
                          background: "linear-gradient(135deg, #f0efff, #fff5f5)",
                          border: "1.5px solid #c5bdfc",
                          borderRadius: "10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px"
                        }}
                      >
                        <div>
                          <b style={{ color: "#564ad9", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase", display: "block" }}>
                            🔍 KNOWLEDGE X-RAY INVESTIGATION
                          </b>
                          <span style={{ fontSize: "12.5px", color: "#34374c", fontWeight: "500" }}>
                            LearnSphere suspects this wrong answer is caused by an earlier prerequisite gap.
                          </span>
                        </div>
                        <button
                          className="primary"
                          style={{ padding: "8px 16px", fontSize: "12px", background: "#6255ef" }}
                          disabled={xrayBusy}
                          onClick={() => runXRayInvestigation(documentName || "Quantum Mechanics", quiz.questions[currentQuestionIndex].question, quiz.questions[currentQuestionIndex].choices[selectedChoice ?? 0])}
                        >
                          {xrayBusy ? "Investigating..." : "Run Knowledge X-Ray →"}
                        </button>
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
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <p className="eyebrow" style={{ color: "#e53e3e", margin: 0 }}>{m.topic}</p>
                            {m.repaired && <span className="badge-repaired">✓ REPAIRED</span>}
                          </div>
                          <h3 style={{ margin: "4px 0 6px", color: "#202236" }}>{m.label}</h3>
                          <p style={{ margin: 0, fontSize: "13px", color: "#666a7c", lineHeight: "1.5" }}>{m.why}</p>
                          <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#9396a6" }}>
                            {m.created_at} {m.repaired_at ? `· Repaired ${m.repaired_at}` : ""}
                          </p>
                        </div>
                        <button
                          className={m.repaired ? "quiet" : "primary"}
                          style={{ marginLeft: "16px", flexShrink: 0, padding: "8px 14px", fontSize: "12px" }}
                          onClick={() => {
                            setActiveRepairModal(m);
                            setVerificationChoice(undefined);
                            setVerificationResult(m.repaired ? "✓ Mental model repaired and recorded." : "");
                          }}
                        >
                          {m.repaired ? "Review Repair →" : "Repair →"}
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

      {/* KNOWLEDGE X-RAY DIAGNOSTIC MODAL (7-STAGE PROGRESSIVE EXPERIENCE) */}
      {activeXRayModal && (
        <div className="modal-backdrop" onClick={() => setActiveXRayModal(null)}>
          <div className="modal" style={{ maxWidth: "640px" }} onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setActiveXRayModal(null)}>
              ×
            </button>
            <p className="eyebrow" style={{ color: "var(--brand-primary)", letterSpacing: "1px" }}>
              🔍 KNOWLEDGE X-RAY DIAGNOSIS
            </p>

            {/* STAGE 1 & 2: Investigating & Suspected Root Gap */}
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ margin: "2px 0 4px", fontSize: "20px", color: "var(--text-primary)" }}>
                Investigating why you struggled with <em>{activeXRayModal.original_failed_concept}</em>...
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                Tracing prerequisite knowledge graph dependencies to diagnose the root gap.
              </p>
            </div>

            {/* Visual Prerequisite Traversal Banner */}
            <div
              style={{
                background: "var(--brand-light)",
                border: "1px solid var(--border-focus)",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "16px",
              }}
            >
              <span style={{ color: "var(--brand-text)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                PREREQUISITE TRAVERSAL CHAIN
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#991b1b", borderRadius: "16px", fontSize: "12px", fontWeight: 700 }}>
                  {activeXRayModal.original_failed_concept}
                </span>
                <span style={{ color: "var(--brand-primary)", fontWeight: "bold" }}>←</span>
                <span style={{ padding: "4px 10px", background: "#fef3c7", color: "#92400e", borderRadius: "16px", fontSize: "12px", fontWeight: 700, border: "1px solid #f59e0b" }}>
                  {activeXRayModal.suspected_root_concept} (Suspected Root)
                </span>
                {activeXRayModal.prerequisite_chain.slice(2).map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "#85889a" }}>←</span>
                    <span style={{ padding: "4px 10px", background: "#f3f4f6", color: "#4b5563", borderRadius: "16px", fontSize: "12px", fontWeight: 600 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 2 Evidence Pill Breakdown */}
            {activeXRayModal.candidate_suspicions.length > 0 && !probeResult && (
              <div style={{ background: "#fafafa", border: "1px solid #e8e7f0", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px" }}>
                <b style={{ color: "var(--brand-text)", fontSize: "10px", letterSpacing: "0.8px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  CONCISE SUSPICION EVIDENCE ({activeXRayModal.suspected_root_concept})
                </b>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {activeXRayModal.candidate_suspicions[0].evidence.map((ev, i) => (
                    <span key={i} style={{ fontSize: "11px", fontWeight: 600, background: "#f0efff", color: "#564ad9", padding: "3px 9px", borderRadius: "14px" }}>
                      ✓ {ev}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* STAGE 3: Targeted Diagnostic Micro-Probe Question */}
            {activeXRayModal.probe_question && !probeResult && (
              <div style={{ background: "#fffdf5", border: "1px solid #fef08a", borderRadius: "12px", padding: "16px", marginTop: "12px" }}>
                <span style={{ color: "#b45309", fontSize: "10px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  STAGE 3: TARGETED DIAGNOSTIC MICRO-PROBE
                </span>
                <b style={{ fontSize: "14px", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>
                  {activeXRayModal.probe_question.question}
                </b>
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "var(--text-muted)" }}>
                  Testing foundation in '{activeXRayModal.suspected_root_concept}' to confirm root gap.
                </p>

                {activeXRayModal.probe_question.choices.map((opt, i) => (
                  <button
                    key={opt}
                    className={probeChoice === i ? "choice selected" : "choice"}
                    onClick={() => setProbeChoice(i)}
                    style={{ background: "#fff", marginTop: "6px" }}
                  >
                    {opt}
                  </button>
                ))}

                <button
                  className="btn-primary"
                  style={{ marginTop: "12px", width: "100%" }}
                  disabled={probeChoice === undefined || xrayBusy}
                  onClick={handleProbeSubmit}
                >
                  {xrayBusy ? "Evaluating Probe..." : "Submit Diagnostic Probe →"}
                </button>
              </div>
            )}

            {/* STAGE 4 & 5: Root Gap Confirmation & Repair Bridge */}
            {probeResult && (
              <div style={{ marginTop: "14px", padding: "16px 18px", background: probeResult.root_gap_confirmed ? "#fee2e2" : "#d1fae5", borderRadius: "12px", border: `1px solid ${probeResult.root_gap_confirmed ? "#fecaca" : "#a7f3d0"}` }}>
                <b style={{ color: probeResult.root_gap_confirmed ? "#991b1b" : "#065f46", fontSize: "13px", display: "block", marginBottom: "4px" }}>
                  {probeResult.root_gap_confirmed ? "🔴 ROOT KNOWLEDGE GAP CONFIRMED" : "✓ FOUNDATION INTACT"}
                </b>
                <p style={{ margin: 0, fontSize: "13px", color: "#202236", lineHeight: "1.5" }}>
                  {probeResult.explanation}
                </p>

                {probeResult.root_gap_confirmed && probeResult.repair_misconception && (
                  <button
                    className="btn-primary"
                    style={{ marginTop: "12px", width: "100%", background: "#dc2626" }}
                    onClick={() => {
                      setActiveXRayModal(null);
                      setActiveRepairModal(probeResult.repair_misconception);
                    }}
                  >
                    Repair Foundation ({probeResult.confirmed_root_concept}) Now →
                  </button>
                )}
              </div>
            )}

            {/* STAGE 6 & 7: Return to Original Concept & Mastery Unlocked */}
            {probeResult && !probeResult.root_gap_confirmed && !retestResult && (
              <div style={{ marginTop: "16px", borderTop: "1px solid #eee", paddingTop: "14px" }}>
                <span style={{ color: "#059669", fontSize: "10px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  STAGE 7: RETURN TO ORIGINAL CONCEPT
                </span>
                <b style={{ fontSize: "14px", color: "var(--text-primary)" }}>Re-test: {activeXRayModal.original_failed_concept}</b>
                <p style={{ margin: "4px 0 10px", fontSize: "12px", color: "var(--text-muted)" }}>
                  Now that the foundation is verified, let's verify your unlocked mastery of '{activeXRayModal.original_failed_concept}'.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["I now understand how the underlying prerequisite connects and resolves this concept correctly.", "The concept still operates independently without relation."].map((opt, i) => (
                    <button
                      key={opt}
                      className={retestChoice === i ? "choice selected" : "choice"}
                      onClick={() => setRetestChoice(i)}
                      style={{ background: "#fff" }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: "12px", width: "100%", background: "#059669" }}
                  disabled={retestChoice === undefined || xrayBusy}
                  onClick={handleRetestSubmit}
                >
                  Verify Unlocked Concept →
                </button>
              </div>
            )}

            {/* Final Stage 7 Retest Success Banner */}
            {retestResult && (
              <div style={{ marginTop: "16px", padding: "18px 20px", background: "#d1fae5", borderRadius: "12px", border: "1px solid #a7f3d0", textAlign: "center" }}>
                <div style={{ fontSize: "28px", marginBottom: "4px" }}>🎉</div>
                <b style={{ color: "#065f46", fontSize: "15px", display: "block", marginBottom: "4px" }}>
                  FOUNDATION & CONCEPT MASTERY UNLOCKED!
                </b>
                <p style={{ margin: 0, fontSize: "13px", color: "#047857", lineHeight: "1.5" }}>
                  {retestResult.explanation}
                </p>
                <div style={{ marginTop: "10px", display: "flex", justifyContent: "center", gap: "16px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, background: "#a7f3d0", color: "#065f46", padding: "4px 12px", borderRadius: "16px" }}>
                    {activeXRayModal.suspected_root_concept}: 42% → 76%
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 700, background: "#a7f3d0", color: "#065f46", padding: "4px 12px", borderRadius: "16px" }}>
                    {activeXRayModal.original_failed_concept}: 51% → {retestResult.updated_mastery}%
                  </span>
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: "14px", background: "#059669" }}
                  onClick={() => setActiveXRayModal(null)}
                >
                  Done →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING WHATSAPP-STYLE "ASK META AI" COMPANION WIDGET */}
      {isChatOpen && (
        <div className="fab-chat-window">
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #6255ef, #4e42db)", padding: "14px 18px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <b style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>✨</span> Ask LearnSphere AI
              </b>
              <p style={{ margin: 0, fontSize: "11px", opacity: 0.85 }}>
                {documentName ? `Grounded in: ${documentName}` : "Material Q&A Assistant"}
              </p>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              style={{ background: "none", border: 0, color: "#fff", fontSize: "20px", cursor: "pointer", opacity: 0.85 }}
            >
              ×
            </button>
          </div>

          {/* Chat Messages Body */}
          <div style={{ flex: 1, padding: "14px", overflowY: "auto", background: "#f8f8fc", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#f0efff", border: "1px solid #dcd7fe", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", color: "#564ad9" }}>
              👋 Hi! Ask me anything regarding your uploaded study material. Answers are grounded directly in your document chunks.
            </div>

            {answer && (
              <div className="study-answer" style={{ margin: 0, padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <b style={{ color: "#564ad9", fontSize: "10px" }}>LEARNSPHERE COMPANION</b>
                  <button
                    onClick={() => toggleSpeech(answer.answer)}
                    style={{
                      background: isSpeaking && speakingText === answer.answer ? "#fee2e2" : "#ffffff",
                      color: isSpeaking && speakingText === answer.answer ? "#991b1b" : "#564ad9",
                      border: "1px solid #dcd7fe",
                      borderRadius: "20px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {isSpeaking && speakingText === answer.answer ? "⏹️ Stop" : "🔊 Listen"}
                  </button>
                </div>
                <p style={{ fontSize: "13px", margin: "0 0 8px", lineHeight: "1.5" }}>{answer.answer}</p>
                <div className="citations">
                  {answer.citations?.map((c) => (
                    <span key={c.chunk_id} style={{ fontSize: "10px" }}>Source · p. {c.page_number}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Input Bar */}
          <div style={{ padding: "10px 12px", background: "#fff", borderTop: "1px solid #e8e7f0" }}>
            <form onSubmit={ask} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={documentId ? "Ask a question..." : "Upload material first..."}
                style={{ flex: 1, border: "1px solid #e2e2ec", borderRadius: "20px", padding: "8px 14px", fontSize: "12.5px", outline: "none" }}
              />
              <button
                type="button"
                onClick={startVoiceInput}
                style={{
                  background: isListening ? "#fee2e2" : "#f0efff",
                  border: "1px solid #dcd7fe",
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "14px",
                  cursor: "pointer",
                  flexShrink: 0
                }}
                title="Voice Input"
              >
                {isListening ? "🔴" : "🎙️"}
              </button>
              <button
                type="submit"
                disabled={busy || !documentId}
                style={{
                  background: "#6255ef",
                  color: "#fff",
                  border: 0,
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "14px",
                  cursor: "pointer",
                  flexShrink: 0
                }}
              >
                ↑
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Trigger Button (FAB) */}
      <button
        className="fab-chat-btn"
        onClick={() => setIsChatOpen(!isChatOpen)}
        aria-label="Ask LearnSphere AI"
      >
        <span>{isChatOpen ? "✕" : "✨"}</span>
        <span>{isChatOpen ? "Close AI" : "Ask AI"}</span>
      </button>
    </main>
  );
}
