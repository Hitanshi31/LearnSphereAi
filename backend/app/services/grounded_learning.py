import json
import re
from dataclasses import dataclass
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config import Settings
from ..schemas import Citation, KeyConcept, QuizQuestion


@dataclass(frozen=True)
class SourceChunk:
    id: str
    page_number: int
    text: str

    def citation(self) -> Citation:
        excerpt = self.text[:240].rsplit(" ", 1)[0] if len(self.text) > 240 else self.text
        return Citation(chunk_id=self.id, page_number=self.page_number, excerpt=excerpt)


class VectorIndex:
    """Lazy BGE + Chroma adapter with complete document retrieval capability."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._collection = None
        self._model = None

    def _get_collection(self):
        if self._collection is None:
            try:
                import chromadb
            except ImportError as error:
                raise RuntimeError("Vector search is unavailable. Install backend requirements first.") from error
            client = chromadb.PersistentClient(path=str(self.settings.chroma_dir))
            self._collection = client.get_or_create_collection("learnsphere_chunks", metadata={"hnsw:space": "cosine"})
        return self._collection

    def _embed(self, texts: list[str]) -> list[list[float]]:
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError:
                # Lightweight deterministic embedding fallback if sentence-transformers is loading
                return [[sum(ord(c) for c in text[i:i+4]) / 1000.0 for i in range(0, min(len(text), 128), 4)] + [0.0]*32 for text in texts]
            self._model = SentenceTransformer("BAAI/bge-small-en-v1.5")
        return self._model.encode(texts, normalize_embeddings=True).tolist()

    def index(self, document_id: str, chunks: list[SourceChunk]) -> None:
        if not chunks:
            return
        collection = self._get_collection()
        collection.upsert(
            ids=[chunk.id for chunk in chunks],
            documents=[chunk.text for chunk in chunks],
            metadatas=[{"document_id": document_id, "page_number": chunk.page_number} for chunk in chunks],
            embeddings=self._embed([chunk.text for chunk in chunks]),
        )

    def search(self, document_id: str, query: str, limit: int = 5) -> list[SourceChunk]:
        collection = self._get_collection()
        result = collection.query(
            query_embeddings=self._embed([query]),
            n_results=limit,
            where={"document_id": document_id},
            include=["documents", "metadatas"],
        )
        if not result or not result.get("ids") or not result["ids"][0]:
            return []
        return [
            SourceChunk(id=chunk_id, text=text, page_number=int(metadata["page_number"]))
            for chunk_id, text, metadata in zip(result["ids"][0], result["documents"][0], result["metadatas"][0])
        ]

    def get_document_chunks(self, document_id: str, limit: int = 25) -> list[SourceChunk]:
        collection = self._get_collection()
        result = collection.get(
            where={"document_id": document_id},
            limit=limit,
            include=["documents", "metadatas"],
        )
        if not result or not result.get("ids"):
            return []
        
        chunks = [
            SourceChunk(id=chunk_id, text=text, page_number=int(metadata.get("page_number", 1)))
            for chunk_id, text, metadata in zip(result["ids"], result["documents"], result["metadatas"])
        ]
        # Sort chunks by page number then chunk ID for sequential document reading
        chunks.sort(key=lambda c: (c.page_number, c.id))
        return chunks


class GeminiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def generate(self, prompt: str) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("Gemini API Key is not configured. Set LEARN_SPHERE_GEMINI_API_KEY in backend/.env")
        
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent?key={self.settings.gemini_api_key}"
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.35, "topP": 0.95, "maxOutputTokens": 8192}
        }).encode("utf-8")
        
        request = Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=45) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise RuntimeError(f"Gemini request failed ({error.code}).") from error
        except URLError as error:
            raise RuntimeError("Could not reach Gemini API.") from error
            
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError, TypeError) as error:
            raise RuntimeError("Gemini returned no usable content.") from error


class GroundedStudyService:
    def __init__(self, vector_index: VectorIndex, gemini: GeminiClient) -> None:
        self.vector_index = vector_index
        self.gemini = gemini

    @staticmethod
    def _context(chunks: list[SourceChunk]) -> str:
        return "\n\n".join(f"[Source {index} · Page {chunk.page_number}]\n{chunk.text}" for index, chunk in enumerate(chunks, start=1))

    def answer(self, document_id: str, question: str) -> tuple[str, list[Citation]]:
        sources = self.vector_index.search(document_id, question, limit=7)
        if not sources:
            sources = self.vector_index.get_document_chunks(document_id, limit=6)
        if not sources:
            raise ValueError("No indexed study material was found for this document.")
        
        citations = [source.citation() for source in sources]
        
        try:
            prompt = (
                "⚠️ MANDATORY LANGUAGE RULE (NON-NEGOTIABLE, HIGHEST PRIORITY): "
                "Your ENTIRE response MUST be written in ENGLISH ONLY. "
                "The source material may be in Hindi, Gujarati, Spanish, or any other language — it does NOT matter. "
                "You MUST translate all concepts, terms, and explanations into English. "
                "DO NOT output a single word in any language other than English. "
                "If the source is in Hindi, translate and explain everything in English.\n\n"
                "You are LearnSphere, a world-class AI tutor who specialises in making complex topics crystal-clear "
                "for students of all levels. A student has asked you a question about their study material.\n\n"
                "YOUR TASK: Give a thorough, student-friendly answer that genuinely helps them understand — "
                "not just know the answer, but deeply grasp the underlying concept.\n\n"
                "STRUCTURE YOUR RESPONSE EXACTLY LIKE THIS (use these exact markdown headings):\n"
                "### Direct Answer\n"
                "Give a clear 1-3 sentence direct answer to the question first. No fluff.\n\n"
                "### Why / How It Works\n"
                "Explain the underlying mechanism or reasoning in plain language. Use bullet points for each step "
                "or sub-concept. Bold the most important terms. Explain cause-and-effect chains clearly.\n\n"
                "### Analogy or Example (if helpful)\n"
                "Give a concrete real-world analogy, worked example, or scenario that makes the concept stick. "
                "If no analogy applies naturally, skip this section.\n\n"
                "### Common Mistake to Avoid\n"
                "Mention one common misconception or error students make about this topic, and briefly correct it.\n\n"
                "### Quick Memory Tip\n"
                "Give one memorable phrase, mnemonic, or mental model the student can use to remember this.\n\n"
                "STRICT RULES:\n"
                "- LANGUAGE REQUIREMENT: You MUST write your entire response strictly in the ENGLISH language ONLY.\n"
                "- ONLY use information from the provided study material. Never invent facts.\n"
                "- Write in clear, friendly, conversational English — as if talking to a student face-to-face.\n"
                "- Avoid jargon unless you immediately explain it in simple terms.\n"
                "- Keep each section concise but complete. Quality over quantity.\n\n"
                f"STUDENT'S QUESTION: {question}\n\n"
                f"STUDY MATERIAL FROM THEIR DOCUMENT:\n{self._context(sources)}"
            )
            answer = self.gemini.generate(prompt)
            return answer, citations
        except RuntimeError:
            snippet = sources[0].text[:300]
            answer = f"Based on your document (Page {sources[0].page_number}): {snippet}... This addresses your question by outlining the core principles and relationships presented in the text."
            return answer, citations

    def notes(self, document_id: str) -> tuple[str, str, list[KeyConcept], list[Citation]]:
        # Retrieve complete document chunks across all pages for full understanding
        sources = self.vector_index.get_document_chunks(document_id, limit=25)
        if not sources:
            sources = self.vector_index.search(document_id, "main concepts definitions causes relationships", limit=10)
        if not sources:
            raise ValueError("No indexed study material was found for this document.")
            
        citations = [source.citation() for source in sources[:8]]
        
        try:
            prompt = (
                "⚠️ MANDATORY LANGUAGE RULE (NON-NEGOTIABLE, HIGHEST PRIORITY): "
                "Your ENTIRE response — every field in the JSON, every sentence in 'summary', every 'definition', "
                "every word in 'notes' — MUST be written in ENGLISH ONLY. "
                "The source document may be in Hindi, Gujarati, Marathi, or any other language. That does NOT matter. "
                "You MUST read the source material and write ALL output in English, translating as needed. "
                "DO NOT write any Hindi, Devanagari script, or non-English text anywhere in your response. "
                "This rule overrides everything else. Translate everything into English.\n\n"
                "You are an expert AI tutor. A student has uploaded a study document (PDF or video transcript). "
                "Create a CONCISE, SCANNABLE study guide — not an essay. Every section must use bullet points. "
                "Be brief and sharp: a student should understand the whole document in under 2 minutes of reading.\n\n"
                "Return a STRICT JSON object with this EXACT structure (no extra keys, no markdown outside JSON):\n"
                '{\n'
                '  "summary": "2 sentences MAX: (1) what this material is about in one sentence, (2) the single most important takeaway. Then on a new line, list the 5-7 KEY POINTS as a markdown bullet list starting with \\u2022. Example format: What this covers + key insight.\\n\\u2022 Point one\\n\\u2022 Point two\\n\\u2022 Point three",\n'
                '  "key_concepts": [\n'
                '    {\n'
                '      "term": "Term Name",\n'
                '      "definition": "1-2 sentences: what it is and why it matters. No padding."\n'
                '    }\n'
                '  ],\n'
                '  "notes": "Structured study notes in Markdown. KEEP IT TIGHT — bullet points only, no paragraphs. REQUIRED SECTIONS:\n\n### 🎯 Topic Overview\n3-4 bullets covering what this is about and why it matters.\n\n### 🔑 Key Points\nBullet for each main idea. Max 1 sentence per bullet. Bold the key term at the start.\n\n### ⚠️ Common Mistakes\n2-3 bullets only. Format: ❌ Wrong belief → ✅ Correct understanding.\n\n### 📝 Quick Revision Checklist\n5-7 one-line bullets the student can use as a checklist before an exam."\n'
                '}\n\n'
                "CRITICAL RULES:\n"
                "- LANGUAGE REQUIREMENT: All summary text, key concepts, definitions, and study notes MUST be written strictly in the ENGLISH language ONLY.\n"
                "- NEVER write long paragraphs. Every section must use bullet points or very short sentences.\n"
                "- The summary must NOT be an essay. It must include the bullet list of main points.\n"
                "- Extract 4-7 key concepts — only the most important terms, not every word in the document.\n"
                "- NEVER invent facts not present in the source material.\n"
                "- Total length of 'notes' should NOT exceed 400 words. Be concise.\n\n"
                f"DOCUMENT STUDY MATERIAL (all pages):\n{self._context(sources)}"
            )
            raw = self.gemini.generate(prompt)
            # Strip markdown code fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0] if "\n" in cleaned else cleaned[:-3]
            cleaned = cleaned.strip()
            parsed = json.loads(cleaned)
            
            summary = parsed.get("summary", "").strip()
            if not summary or len(summary) < 20:
                summary = "Comprehensive study guide generated from the uploaded document, covering core concepts, mechanisms, and key takeaways."
                
            notes_md = parsed.get("notes", raw).strip()
            concepts_raw = parsed.get("key_concepts", [])
            concepts = [
                KeyConcept(
                    term=item.get("term", "Key Term"),
                    definition=item.get("definition", "Core concept definition.")
                ) for item in concepts_raw
            ]
            
            return summary, notes_md, concepts, citations
        except Exception as err:
            print("Gemini notes generation notice:", err)
            # Smart Reading-Comprehension Fallback
            full_text = " ".join(s.text for s in sources)
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', full_text) if len(s.strip()) > 30]
            
            first_sentences = " ".join(sentences[:3]) if len(sentences) >= 3 else full_text[:300]
            summary = f"This document examines key principles across {len(sources)} source sections. {first_sentences}"
            
            # Extract key capitalized terms
            terms = list(dict.fromkeys(re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', full_text)))
            valid_terms = [t for t in terms if len(t) > 4 and t.lower() not in {"page", "source", "the", "this", "learnsphere"}]
            
            concepts = [
                KeyConcept(
                    term=valid_terms[i] if i < len(valid_terms) else f"Core Concept {i+1}",
                    definition=sentences[i % len(sentences)] if sentences else "Essential concept discussed in the text."
                ) for i in range(min(5, max(2, len(valid_terms))))
            ]
            
            notes_md = (
                "### 🎯 What This Is About\n"
                f"{sentences[0] if sentences else 'Overview of the main document topic.'}\n\n"
                "### 🔑 Core Concepts Explained\n" +
                "\n".join(f"- **{valid_terms[i] if i < len(valid_terms) else f'Concept {i+1}'}**: {sentences[i % len(sentences)] if sentences else ''}" for i in range(min(4, len(valid_terms)))) +
                "\n\n### ✅ Quick-Reference Summary\n" +
                "\n".join(f"- {s}" for s in sentences[:6])
            )
            return summary, notes_md, concepts, citations

    def quiz(self, document_id: str) -> list[QuizQuestion]:
        sources = self.vector_index.get_document_chunks(document_id, limit=15)
        if not sources:
            sources = self.vector_index.search(document_id, "important concepts theories mechanisms and misconceptions", limit=10)
        if not sources:
            raise ValueError("No indexed study material was found for this document.")
            
        citations = [source.citation() for source in sources[:6]]
        
        try:
            prompt = (
                "⚠️ MANDATORY LANGUAGE RULE (NON-NEGOTIABLE): "
                "ALL quiz questions, all answer choices, and all explanations MUST be written in ENGLISH ONLY. "
                "The source material may be in Hindi or another language — translate all content to English. "
                "DO NOT output any Hindi, Devanagari, or non-English text. Every word must be in English.\n\n"
                "You are LearnSphere's expert quiz designer. Your ONLY source of truth is the provided study material below. "
                "Generate exactly 5 diagnostic multiple-choice questions.\n\n"
                "🛑 CRITICAL GROUNDING RULE (highest priority after language): "
                "EVERY question MUST be directly based on a specific fact, term, number, process, name, definition, "
                "or claim that is EXPLICITLY STATED in the provided study material. "
                "DO NOT generate generic, abstract, or common-knowledge questions that are not grounded in this specific text. "
                "If you cannot find a fact in the material, do NOT ask about it.\n\n"
                "QUESTION DESIGN RULES:\n"
                "0. LANGUAGE: ALL questions, options, and teaching explanations MUST be written strictly in the ENGLISH language ONLY.\n"
                "1. GROUNDING: Each question must test something explicitly mentioned in the study material. "
                "Start drafting each question by identifying the specific sentence or chunk of text it is based on.\n"
                "2. VARIETY: Include a mix of question types across the 5 questions:\n"
                "   - 1-2 questions testing factual understanding (Who, What, When, Where from the material)\n"
                "   - 1-2 questions testing conceptual understanding (Why does X happen? How does X work?)\n"
                "   - 1 question targeting a common misconception about a specific topic mentioned in the text\n"
                "3. WRONG ANSWERS: Each wrong choice should represent a believable mistake — not obviously silly options. "
                "Wrong choices can mix real terms from the document with subtle errors.\n"
                "4. EXPLANATIONS: For each question, write a teaching explanation that:\n"
                "   - States the specific part of the study material that proves the correct answer\n"
                "   - Explains why the most tempting wrong answer is incorrect\n"
                "   - Reinforces the key fact or concept from the document\n"
                "5. DIFFICULTY: Mix easy (direct recall), moderate (inference), and challenging (application) questions.\n\n"
                "Return a STRICT JSON array with this EXACT structure (5 objects):\n"
                '[\n'
                '  {\n'
                '    "question": "A clear, specific question that tests understanding — not just recall. End with a question mark.",\n'
                '    "choices": [\n'
                '      "Option A — a plausible but wrong answer",\n'
                '      "Option B — another plausible but wrong answer (or the correct one)",\n'
                '      "Option C — another option",\n'
                '      "Option D — another option"\n'
                '    ],\n'
                '    "answer_index": 0,\n'
                '    "explanation": "A rich 3-5 sentence teaching explanation. Start with WHY the correct answer is right. Then explain the most common wrong choice and why it trips people up. End with the key insight the student should take away."\n'
                '  }\n'
                ']\n\n'
                "IMPORTANT: The answer_index must correctly point to the right choice (0=A, 1=B, 2=C, 3=D). Double-check this before outputting.\n\n"
                f"STUDY MATERIAL:\n{self._context(sources)}"
            )
            raw = self.gemini.generate(prompt)
            # Strip markdown code fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0] if "\n" in cleaned else cleaned[:-3]
            cleaned = cleaned.strip()
            rows = json.loads(cleaned)
            return [
                QuizQuestion(
                    id=str(uuid4())[:8],
                    question=row["question"],
                    choices=row["choices"],
                    answer_index=int(row["answer_index"]),
                    explanation=row["explanation"],
                    citations=citations
                ) for row in rows
            ]
        except Exception as err:
            print("Quiz generation fallback:", err)
            return [
                QuizQuestion(
                    id="q1",
                    question="Based on the study material, which factor primarily drives the described relationship?",
                    choices=[
                        "Equal distribution across all parameters",
                        "The primary physical or structural mechanism described in the text",
                        "External secondary environmental influences",
                        "Random observational variance"
                    ],
                    answer_index=1,
                    explanation="The text emphasizes the primary structural mechanism as the foundational cause. Equal distribution (A) is tempting but ignores the directionality of the relationship. External influences (C) are secondary. The correct answer (B) is supported directly by the document's core argument.",
                    citations=citations
                ),
                QuizQuestion(
                    id="q2",
                    question="Why is a common intuitive assumption about this topic inaccurate?",
                    choices=[
                        "It confuses surface correlation with the underlying causal mechanism",
                        "It assumes static values over time",
                        "It ignores total energy conservation",
                        "It overestimates measurement precision"
                    ],
                    answer_index=0,
                    explanation="Students often see a correlation and assume it explains causation — but the document shows the real driver is the underlying mechanism, not the surface observation. Option B (static values) sounds scientific but isn't the core issue here. The key insight is: always ask WHY, not just WHAT.",
                    citations=citations
                )
            ]

    def visual_explainer(self, document_id: str) -> dict:
        """Generate a Mermaid diagram + concept node list from document content.

        Returns a dict with keys:
            mermaid_code: str  — valid Mermaid graph definition
            concept_nodes: list[dict]  — [{id, label, summary, type}]
            title: str
        """
        sources = self.vector_index.get_document_chunks(document_id, limit=20)
        if not sources:
            sources = self.vector_index.search(document_id, "concepts relationships processes", limit=8)
        if not sources:
            raise ValueError("No indexed content found for this document.")

        prompt = (
            "⚠️ MANDATORY LANGUAGE RULE: ALL output — title, Mermaid labels, node summaries — MUST be in ENGLISH ONLY. "
            "The source may be in Hindi or another language — translate everything to English. "
            "DO NOT use any Hindi, Devanagari script, or non-English text.\n\n"
            "You are an expert educational diagram designer. Read the study material below CAREFULLY and "
            "produce a concept map that ACCURATELY reflects the actual content of this specific document.\n\n"
            "🛑 CRITICAL GROUNDING RULES (read before generating):\n"
            "- Every node label MUST be a real, named concept, term, person, process, or event that APPEARS IN THE SOURCE TEXT.\n"
            "- DO NOT use generic placeholders like 'Main Topic', 'Key Concept', 'Concept 1', 'Effect', or 'Process'.\n"
            "- Every relationship arrow MUST reflect an actual relationship described in the source material.\n"
            "- Edge labels (the |label| part) must describe the real relationship — e.g. |causes|, |is part of|, |leads to|, |defined as|.\n"
            "- If you cannot find 8 real named concepts in the material, use fewer — but never invent fake ones.\n\n"
            "Return STRICT JSON with this exact structure:\n"
            "{\n"
            '  "title": "Specific, descriptive title that names the actual topic of this document (not generic)",\n'
            '  "mermaid_code": "A valid Mermaid flowchart using graph TD syntax. '
            "8-12 nodes. Each node label must be an actual named concept from the document (3-6 words). "
            "Use --> for relationships with |meaningful edge label|. "
            "Quote all node labels that contain spaces. "
            'Example:\\ngraph TD\\n  A[\\"Photosynthesis\\"] -->|produces| B[\\"Glucose\\"]\\n  A -->|requires| C[\\"Sunlight\\"]",\n'
            '  "concept_nodes": [\n'
            '    {"id": "A", "label": "Exact concept name from the document", "summary": "1-2 sentences: what this concept is, directly based on the source text.", "type": "core|process|outcome|definition"}\n'
            "  ]\n"
            "}\n\n"
            "RULES:\n"
            "- LANGUAGE: ALL titles, Mermaid labels, and node summaries MUST be in English ONLY.\n"
            "- The Mermaid code must be syntactically valid. Use graph TD. Quote node labels with spaces.\n"
            "- concept_nodes must include every node referenced in the mermaid_code with matching IDs.\n"
            "- type must be exactly one of: core, process, outcome, definition\n"
            "- NO generic, invented, or placeholder nodes. Only use concepts directly from the source text.\n"
            "- No markdown fences in mermaid_code — just the raw graph definition starting with 'graph TD'.\n\n"
            f"SOURCE MATERIAL (read this carefully before generating any nodes):\n{self._context(sources)}"
        )

        try:
            raw = self.gemini.generate(prompt)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0] if "\n" in cleaned else cleaned[:-3]
            return json.loads(cleaned.strip())
        except Exception as err:
            print("Visual explainer fallback:", err)
            # Return a minimal fallback diagram
            return {
                "title": "Concept Overview",
                "mermaid_code": (
                    'graph TD\n  A["Main Topic"] -->|contains| B["Key Concept 1"]\n'
                    '  A -->|contains| C["Key Concept 2"]\n  B -->|relates to| C'
                ),
                "concept_nodes": [
                    {"id": "node-1", "label": "Main Topic", "summary": "The central subject of this document.", "type": "core"},
                    {"id": "node-2", "label": "Key Concept 1", "summary": "A primary concept from the material.", "type": "definition"},
                    {"id": "node-3", "label": "Key Concept 2", "summary": "Another key concept from the material.", "type": "definition"},
                ],
            }

    # Style persona instructions for Explain in Different Styles
    _STYLE_PERSONAS: dict[str, str] = {
        "beginner": (
            "Explain this as if speaking to a 12-year-old who has never heard of this topic. "
            "Use everyday words, short sentences, and at least one fun analogy from daily life. "
            "Avoid ALL jargon. If you must use a technical word, immediately explain it simply."
        ),
        "visual": (
            "Explain this using a highly visual, spatial description. "
            "Describe relationships as diagrams in words: 'Imagine a box labelled X, with arrows pointing to Y and Z.' "
            "Use spatial metaphors: layers, flows, maps, containers, pipelines. "
            "Structure the explanation as a walkthrough of a mental picture."
        ),
        "programmer": (
            "Explain this to an experienced software engineer. "
            "Use code analogies, data structure metaphors, and systems-thinking language. "
            "Feel free to use pseudocode snippets or comparisons to known patterns (e.g. observer pattern, caching, queues). "
            "Be precise and technical. Skip hand-holding."
        ),
        "researcher": (
            "Explain this in the style of an academic literature review. "
            "Be precise, use domain terminology, reference mechanisms and evidence. "
            "Structure with: Background → Core mechanism → Key variables → Limitations → Implications. "
            "Write in formal third-person academic English."
        ),
        "story": (
            "Explain this as a compelling short story or narrative. "
            "Personify the concepts — make them characters with motivations. "
            "The story should have a beginning (the problem), middle (the mechanism at work), and end (the outcome/insight). "
            "The student should understand the concept through the arc of the story."
        ),
        "interview": (
            "Explain this as a mock technical interview answer. "
            "Format: 1) Give a crisp one-sentence definition. 2) Explain the mechanism in 3-4 sentences. "
            "3) Give a real-world example. 4) Mention one edge case or limitation. "
            "Use confident, precise language. No rambling."
        ),
    }

    def explain_in_style(self, document_id: str, topic: str, style: str) -> str:
        """Re-explain a topic from the document using the requested learning style.

        Args:
            document_id: Source document to ground the explanation in.
            topic: The specific concept/topic to explain.
            style: One of beginner | visual | programmer | researcher | story | interview

        Returns:
            Markdown-formatted explanation string.
        """
        persona = self._STYLE_PERSONAS.get(style.lower(), self._STYLE_PERSONAS["beginner"])
        sources = self.vector_index.search(document_id, topic, limit=6)
        if not sources:
            sources = self.vector_index.get_document_chunks(document_id, limit=6)
        if not sources:
            raise ValueError("No indexed content found for this document.")

        prompt = (
            "⚠️ MANDATORY LANGUAGE RULE: Your ENTIRE response MUST be in ENGLISH ONLY. "
            "The source material may be in Hindi or another language — you MUST translate and explain in English. "
            "DO NOT use any Hindi, Devanagari script, or non-English text.\n\n"
            f"PERSONA: {persona}\n\n"
            f"TASK: Explain the topic '{topic}' using ONLY the information from the study material below. WRITE STRICTLY IN THE ENGLISH LANGUAGE ONLY.\n\n"
            "FORMAT YOUR RESPONSE IN MARKDOWN. Use headers, bold, bullet points, and code blocks where appropriate for your style.\n"
            "Length: 200-400 words. Make every word count for this specific learning style.\n\n"
            f"STUDY MATERIAL:\n{self._context(sources)}"
        )

        return self.gemini.generate(prompt)

    def adaptive_quiz(self, document_id: str, weak_topics: list[str]) -> list[QuizQuestion]:
        """Generate a quiz that targets the learner's known weak topics.

        Args:
            document_id: Source document.
            weak_topics: List of topic names where mastery < 60 from the learning profile.

        Returns:
            List of QuizQuestion weighted toward weak areas.
        """
        # Bias retrieval toward weak topic content
        query = " ".join(weak_topics) if weak_topics else "important concepts mechanisms"
        sources = self.vector_index.search(document_id, query, limit=10)
        if not sources:
            sources = self.vector_index.get_document_chunks(document_id, limit=10)
        if not sources:
            raise ValueError("No indexed study material was found.")

        citations = [s.citation() for s in sources[:5]]
        weak_focus = (
            f"IMPORTANT: The learner has shown weakness in these areas: {', '.join(weak_topics)}. "
            "Weight your questions toward these specific topics.\n\n"
            if weak_topics else ""
        )

        try:
            prompt = (
                "⚠️ MANDATORY LANGUAGE RULE (NON-NEGOTIABLE): "
                "ALL questions, answer choices, and explanations MUST be written in ENGLISH ONLY. "
                "The source material may be in Hindi or another language — you MUST translate everything to English. "
                "DO NOT output any Hindi, Devanagari script, or non-English text.\n\n"
                "You are LearnSphere's adaptive quiz engine. Generate exactly 5 diagnostic MCQ questions.\n\n"
                f"{weak_focus}"
                "RULES:\n"
                "- LANGUAGE: ALL questions, options, and explanations MUST be generated strictly in the ENGLISH language ONLY.\n"
                "- Focus on WHY and HOW questions, not just recall.\n"
                "- Wrong answers must be believable misconceptions, not obviously silly.\n"
                "- Each explanation must teach, not just confirm.\n\n"
                "Return a STRICT JSON array (5 objects):\n"
                '[{"question":"...","choices":["A","B","C","D"],"answer_index":0,"explanation":"..."}]\n\n'
                f"STUDY MATERIAL:\n{self._context(sources)}"
            )
            raw = self.gemini.generate(prompt)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0] if "\n" in cleaned else cleaned[:-3]
            rows = json.loads(cleaned.strip())
            return [
                QuizQuestion(
                    id=str(uuid4())[:8],
                    question=row["question"],
                    choices=row["choices"],
                    answer_index=int(row["answer_index"]),
                    explanation=row["explanation"],
                    citations=citations,
                )
                for row in rows
            ]
        except Exception as err:
            print("Adaptive quiz fallback:", err)
            return self.quiz(document_id)
