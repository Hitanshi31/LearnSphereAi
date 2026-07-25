"""YouTube transcript extraction and chunking service.

Supports both youtube-transcript-api v1.x (instance-based API) and v0.6.x (class-based API).
Uses api.fetch / get_transcript — no API key needed for auto-captioned videos.
Chunks transcript text into ~300-word segments with timestamp metadata
so they slot directly into the same ChromaDB pipeline as PDF chunks.
"""

import json
import re
import urllib.request
from dataclasses import dataclass

from .grounded_learning import SourceChunk


def _extract_video_id(url: str) -> str:
    """Extract YouTube video ID from any standard URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/|live/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract a valid YouTube video ID from: {url!r}")


def _fetch_video_title(video_id: str) -> str:
    """Fetch video title using YouTube oEmbed API without requiring an API key."""
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "LearnSphere/1.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                title = data.get("title")
                if title:
                    return title.strip()
    except Exception:
        pass
    return f"YouTube Video ({video_id})"


def _chunk_snippets(
    snippets: list,
    document_id: str,
    words_per_chunk: int = 300,
) -> list[SourceChunk]:
    """Merge raw transcript snippets into fixed-size word-count chunks."""
    chunks: list[SourceChunk] = []
    buffer: list[str] = []
    chunk_index = 0
    start_seconds = 0.0

    for snip in snippets:
        if isinstance(snip, dict):
            text = str(snip.get("text", "")).strip()
            snip_start = float(snip.get("start", 0.0))
        elif hasattr(snip, "text"):
            text = str(getattr(snip, "text", "")).strip()
            snip_start = float(getattr(snip, "start", 0.0))
        else:
            text = str(snip).strip()
            snip_start = 0.0

        if not text:
            continue

        words = text.split()
        if not buffer:
            start_seconds = snip_start

        buffer.extend(words)

        if len(buffer) >= words_per_chunk:
            chunk_text = " ".join(buffer)
            minute = int(start_seconds // 60)
            second = int(start_seconds % 60)
            chunks.append(
                SourceChunk(
                    id=f"{document_id}:yt:{chunk_index}",
                    page_number=chunk_index + 1,
                    text=f"[{minute:02d}:{second:02d}] {chunk_text}",
                )
            )
            chunk_index += 1
            buffer = []

    # Flush any remaining words
    if buffer:
        chunk_text = " ".join(buffer)
        minute = int(start_seconds // 60)
        second = int(start_seconds % 60)
        chunks.append(
            SourceChunk(
                id=f"{document_id}:yt:{chunk_index}",
                page_number=chunk_index + 1,
                text=f"[{minute:02d}:{second:02d}] {chunk_text}",
            )
        )

    return chunks


@dataclass
class YoutubeProcessResult:
    video_id: str
    title: str
    chunks: list[SourceChunk]
    total_words: int
    language: str


class YouTubeProcessor:
    """Fetch and chunk a YouTube video transcript into SourceChunks.

    Compatible with youtube-transcript-api v1.x (instance-based) and v0.x (class-based).
    """

    def process(self, url: str, document_id: str) -> YoutubeProcessResult:
        """Extract transcript from a YouTube URL.

        Args:
            url: Any valid YouTube URL (watch, youtu.be, shorts, embed).
            document_id: The LearnSphere document ID to namespace chunk IDs.

        Returns:
            YoutubeProcessResult with chunks ready for ChromaDB indexing.

        Raises:
            ValueError: If no transcript is available or video ID is invalid.
            RuntimeError: If youtube-transcript-api is not installed.
        """
        try:
            from youtube_transcript_api import (
                CouldNotRetrieveTranscript,
                NoTranscriptFound,
                TranscriptsDisabled,

                VideoUnavailable,
                YouTubeTranscriptApi,
            )
        except ImportError as error:
            raise RuntimeError(
                "youtube-transcript-api is not installed. "
                "Run: pip install 'youtube-transcript-api>=0.6.2'"
            ) from error

        video_id = _extract_video_id(url)
        title = _fetch_video_title(video_id)

        # Detect api style: v1.x instance-based vs v0.x class-based
        api = None
        try:
            api = YouTubeTranscriptApi()
        except Exception:
            api = None

        language_tried = "en"
        fetched = None

        for lang_group in [["en", "en-US", "en-GB"], None]:
            try:
                if lang_group is not None:
                    if api and hasattr(api, "fetch"):
                        fetched = api.fetch(video_id, languages=lang_group)
                    else:
                        fetched = YouTubeTranscriptApi.get_transcript(video_id, languages=lang_group)
                    language_tried = lang_group[0]
                else:
                    # Fallback: list all transcripts, pick the first one
                    if api and hasattr(api, "list"):
                        transcript_list = api.list(video_id)
                        first = next(iter(transcript_list))
                        fetched = first.fetch()
                        language_tried = getattr(first, "language_code", "unknown")
                    else:
                        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                        first = next(iter(transcript_list))
                        fetched = first.fetch()
                        language_tried = getattr(first, "language_code", "unknown")
                break
            except (NoTranscriptFound, CouldNotRetrieveTranscript):
                if lang_group is None:
                    raise ValueError(f"No transcript available for video {video_id!r}.")
                continue
            except (TranscriptsDisabled, VideoUnavailable) as error:
                raise ValueError(f"Could not retrieve transcript for video {video_id!r}: {error}") from error
            except Exception as exc:
                if lang_group is None:
                    raise ValueError(f"Failed to fetch transcript for video {video_id!r}: {exc}") from exc
                continue

        if fetched is None:
            raise ValueError(
                f"No transcript available for video {video_id!r}. "
                "The video may have transcripts disabled or no English captions."
            )

        snippets = list(fetched)
        if not snippets:
            raise ValueError("Transcript was empty after processing.")

        chunks = _chunk_snippets(snippets, document_id)
        if not chunks:
            raise ValueError("Transcript yielded no usable chunks.")

        total_words = sum(len(c.text.split()) for c in chunks)

        return YoutubeProcessResult(
            video_id=video_id,
            title=title,
            chunks=chunks,
            total_words=total_words,
            language=language_tried,
        )
