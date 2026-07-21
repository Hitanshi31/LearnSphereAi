from dataclasses import dataclass
from pathlib import Path
import re
import fitz


@dataclass(frozen=True)
class ExtractedChunk:
    page_number: int
    text: str


@dataclass(frozen=True)
class ProcessedDocument:
    page_count: int
    chunks: list[ExtractedChunk]
    extracted_characters: int


class PdfProcessor:
    """Extracts page-aware text chunks while retaining source provenance."""

    def __init__(self, chunk_words: int = 180, overlap_words: int = 30) -> None:
        self.chunk_words = chunk_words
        self.overlap_words = overlap_words

    def process(self, file_path: Path) -> ProcessedDocument:
        chunks: list[ExtractedChunk] = []
        extracted_characters = 0

        with fitz.open(file_path) as pdf:
            for index, page in enumerate(pdf, start=1):
                text = self._normalize(page.get_text("text"))
                extracted_characters += len(text)
                chunks.extend(ExtractedChunk(index, chunk) for chunk in self._chunk(text))

            return ProcessedDocument(
                page_count=pdf.page_count,
                chunks=chunks,
                extracted_characters=extracted_characters,
            )

    @staticmethod
    def _normalize(text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    def _chunk(self, text: str) -> list[str]:
        words = text.split()
        if not words:
            return []

        chunks: list[str] = []
        start = 0
        while start < len(words):
            end = min(start + self.chunk_words, len(words))
            chunks.append(" ".join(words[start:end]))
            if end == len(words):
                break
            start = end - self.overlap_words
        return chunks
