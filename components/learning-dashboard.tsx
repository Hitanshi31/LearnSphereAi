"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  askStudyQuestion,
  generateNotes,
  generateQuiz,
  getLearningProfile,
  submitAttempt,
  uploadDocument,
  type Citation,
  type KeyConcept,
  type LearningProfile,
  type MisconceptionInsight,
  type Quiz,
  type StudyAnswer,
  type StudyNotes,
  type UploadedDocument,
} from "@/lib/documents-api";

const learnerId = "alex";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
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

export function LearningDashboard() {
  const [nav, setNav] = useState("Overview");
  const [documentId, setDocumentId] = useState<string>();
  const [documentName, setDocumentName] = useState<string>("");
  const [docDetails, setDocDetails] = useState<UploadedDocument | null>(null);
  const [profile, setProfile] = useState<LearningProfile>();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<StudyAnswer>();
  const [notes, setNotes] = useState<StudyNotes>();
  const [quiz, setQuiz] = useState<Quiz>();
  const [selectedChoice, setSelectedChoice] = useState<number>();
  const [confidence, setConfidence] = useState<number>(4);
  const [insight, setInsight] = useState<MisconceptionInsight>();
  const [activeRepairModal, setActiveRepairModal] = useState<MisconceptionInsight | null>(null);
  const [verificationChoice, setVerificationChoice] = useState<number>();
  const [verificationResult, setVerificationResult] = useState<string>("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshProfile = async () => {
    try {
      const p = await getLearningProfile(learnerId);
      setProfile(p);
    } catch {
      setStatus("Connect backend API (http://localhost:8000) to sync your live learning profile.");
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Please select a valid PDF document.");
      return;
    }
    setBusy(true);
    setUploadProgress(true);
    setStatus(`Processing ${file.name}... extracting text & generating BGE embeddings.`);
    try {
      const doc = await uploadDocument(file);
      setDocumentId(doc.id);
      setDocumentName(doc.filename);
      setDocDetails(doc);
      setAnswer(undefined);
      setQuiz(undefined);
      
      setStatus(`${doc.filename} indexed — ${doc.page_count} pages, ${doc.chunk_count} chunks, ${doc.extracted_characters} characters.`);
      
      // Auto-generate Summary & Study Notes on upload
      try {
        const generatedNotes = await generateNotes(doc.id);
        setNotes(generatedNotes);
      } catch (err) {
        console.log("Notes generation notice:", err);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadProgress(false);
    }
  };

  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
    event.target.value = "";
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
    if (!documentId) return setStatus("Please upload a PDF document first.");
    setBusy(true);
    setStatus("Analyzing document & generating grounded summary...");
    try {
      const res = await generateNotes(documentId);
      setNotes(res);
      setStatus("Summary & Study Notes generated successfully!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create notes.");
    } finally {
      setBusy(false);
    }
  };

  const loadQuiz = async () => {
    if (!documentId) return setStatus("Please upload a PDF document first.");
    setBusy(true);
    setStatus("Generating diagnostic quiz from material...");
    try {
      const res = await generateQuiz(documentId);
      setQuiz(res);
      setSelectedChoice(undefined);
      setStatus("Diagnostic quiz generated!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create a quiz.");
    } finally {
      setBusy(false);
    }
  };

  const submitQuizAttempt = async () => {
    const currentQ = quiz?.questions[0];
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
      if (result.misconception) {
        setInsight(result.misconception);
        setStatus("Misconception detected! Your profile was updated with targeted learning insights.");
      } else if (isCorrect) {
        setStatus("Correct! Your mastery and confidence alignment score increased.");
      } else {
        setStatus("Incorrect — your learning profile was updated to adapt future explanations.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not record your answer.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerificationCheck = () => {
    if (!activeRepairModal || verificationChoice === undefined) return;
    if (verificationChoice === activeRepairModal.verification_correct_index) {
      setVerificationResult("Correct! Mental model repaired. Your learning profile updated.");
      refreshProfile();
    } else {
      setVerificationResult("Not quite — review the Scientific Reality section above and try again.");
    }
  };

  const activeInsight = insight ?? profile?.recent_misconceptions[0];
  const navItems = ["Overview", "My materials", "Study notes", "Practice", "Learning profile"];

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
              onChange={upload}
            />
            <button
              className="upload"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {uploadProgress ? "Processing PDF..." : busy ? "Working..." : "+ Upload PDF"}
            </button>
          </div>
        </header>

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
                <p className="eyebrow">FEATURE 1 ACTION</p>
                <h3>
                  {documentName ? `${documentName}` : "Upload your study PDF"}
                </h3>
                <p className="muted">
                  {documentName
                    ? `${docDetails?.page_count ?? 2} pages indexed. Generate AI Notes & Summary.`
                    : "Upload a PDF to extract text, create vector embeddings, and generate a summary."}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    if (documentName) {
                      setNav("Study notes");
                    } else {
                      fileInput.current?.click();
                    }
                  }}
                >
                  {documentName ? "View Summary & Notes" : "Upload PDF now"} <span>→</span>
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
                    No mastery data yet. Upload a PDF and complete a diagnostic quiz.
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

        {/* TAB 2: MY MATERIALS (FEATURE 1 UPLOADING) */}
        {nav === "My materials" && (
          <div>
            <Card className="ask">
              <h3>PDF Document Upload & Indexing</h3>
              <p>Upload any PDF textbook, paper, or notes. PyMuPDF extracts text and indexes chunks into ChromaDB with BGE embeddings.</p>

              <div
                style={{
                  border: "2px dashed #d9d6f8",
                  borderRadius: "12px",
                  padding: "36px 20px",
                  textAlign: "center",
                  background: "#f9f8fe",
                  cursor: "pointer",
                  marginTop: "16px",
                  transition: "all 0.15s ease",
                }}
                onClick={() => fileInput.current?.click()}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
                <h4 style={{ margin: "0 0 6px", fontSize: "16px", color: "#564ad9", fontWeight: "700" }}>
                  {busy ? "Processing PDF document..." : "Click to select or drop a PDF file here"}
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#85889a" }}>
                  Supports text-based PDF documents up to 20MB
                </p>
              </div>

              {documentName && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    background: "#f0efff",
                    borderRadius: "10px",
                    border: "1px solid #dcd7fe",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#564ad9", textTransform: "uppercase" }}>
                      ACTIVE INDEXED MATERIAL
                    </span>
                    <h4 style={{ margin: "4px 0 2px", fontSize: "15px", color: "#202236", fontWeight: "700" }}>
                      {documentName}
                    </h4>
                    <p style={{ margin: 0, fontSize: "12px", color: "#747789" }}>
                      {docDetails ? `${docDetails.page_count} Pages · ${docDetails.chunk_count} Chunks · ${docDetails.extracted_characters} Characters Extracted` : "Indexed and ready for study."}
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setNav("Study notes")}
                  >
                    Generate Summary →
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: STUDY NOTES (FEATURE 1 SUMMARY GENERATION) */}
        {nav === "Study notes" && (
          <Card className="ask">
            <h3>AI Summary & Grounded Study Notes</h3>
            <p>Generates an executive overview, key concepts dictionary, and grounded study notes from your uploaded PDF.</p>

            <button className="primary" disabled={busy || !documentId} onClick={loadNotes}>
              {notes ? "Regenerate Summary & Notes" : "Generate Summary & Notes"}
            </button>

            {!documentId && (
              <p style={{ marginTop: "14px", color: "#e53e3e", fontSize: "13px" }}>
                ⚠️ Please upload a PDF document first under "My materials" or using the "+ Upload PDF" button.
              </p>
            )}

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
        )}

        {/* TAB 4: PRACTICE (DIAGNOSTIC QUIZ) */}
        {nav === "Practice" && (
          <Card className="ask">
            <h3>Diagnostic practice</h3>
            <p>Questions focus on reasoning and misconceptions so your Learning Profile can adapt.</p>
            <button className="primary" disabled={busy || !documentId} onClick={loadQuiz}>
              {quiz ? "Regenerate diagnostic quiz" : "Generate a diagnostic quiz"}
            </button>

            {!documentId && (
              <p style={{ marginTop: "14px", color: "#e53e3e", fontSize: "13px" }}>
                ⚠️ Please upload a PDF document first under "My materials" or "+ Upload PDF".
              </p>
            )}

            {quiz?.questions[0] && (
              <div className="study-answer">
                <b>DIAGNOSTIC QUESTION 1</b>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#202236" }}>
                  {quiz.questions[0].question}
                </p>

                {quiz.questions[0].choices.map((choice, index) => (
                  <button
                    key={choice}
                    className={selectedChoice === index ? "choice selected" : "choice"}
                    onClick={() => setSelectedChoice(index)}
                  >
                    {choice}
                  </button>
                ))}

                <p className="eyebrow" style={{ marginTop: "16px" }}>
                  HOW CONFIDENT ARE YOU IN THIS REASONING?
                </p>
                <div className="confidence-selector">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      className={confidence === lvl ? "confidence-btn active" : "confidence-btn"}
                      onClick={() => setConfidence(lvl)}
                    >
                      {lvl === 1 ? "1 (Guess)" : lvl === 5 ? "5 (Certain)" : `${lvl}`}
                    </button>
                  ))}
                </div>

                <button
                  className="primary submit-attempt"
                  disabled={busy || selectedChoice === undefined}
                  onClick={submitQuizAttempt}
                >
                  Check my reasoning
                </button>
              </div>
            )}
          </Card>
        )}

        {/* TAB 5: LEARNING PROFILE */}
        {nav === "Learning profile" && (
          <div>
            <div className="top-grid">
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
            </div>

            <div className="section-heading">
              <div>
                <h2>Topic breakdown</h2>
                <p>Individual conceptual understanding across your uploaded subjects.</p>
              </div>
            </div>

            <Card className="ask">
              <div className="chart" style={{ height: "240px" }}>
                {profile?.topics.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profile.topics}>
                      <XAxis dataKey="topic" tick={{ fontSize: 12, fill: "#7b8195" }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="mastery" fill="#564ad9" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted">No topics recorded yet.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* RAG Grounded Chat Box (Always available) */}
        <Card className="ask">
          <div>
            <h3>Ask about your material</h3>
            <p>{documentId ? "Every response includes source page citations." : "Upload a PDF first."}</p>
          </div>
          <form onSubmit={ask}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask LearnSphere about your PDF concept or reasoning…"
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
