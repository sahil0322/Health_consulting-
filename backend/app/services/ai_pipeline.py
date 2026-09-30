"""
The AI pipeline: audio -> transcript -> structured claims.

Real implementations, not stubs. Two external providers, both needing
nothing more than a single API key (no cloud project, no service
account, no billing console) — this was a deliberate choice to keep
setup friction low:

  - transcribe_audio(): calls OpenAI's Whisper API
    (POST /v1/audio/transcriptions) with response_format=verbose_json to
    get segment-level timestamps. Needs OPENAI_API_KEY.
  - extract_claims(): calls the Anthropic API with a tool-use schema that
    forces every claim to cite the transcript segment numbers it's
    grounded in (PID Section 7.3). Claims with no valid citation are
    dropped rather than silently accepted. Needs ANTHROPIC_API_KEY.
  - redact_pii(): regex-based redaction of high-confidence PII patterns
    (emails, phone numbers, long ID-like digit sequences) before any
    transcript text leaves this process for the LLM (PID Section 7.1).
    This is a BASIC implementation — no concept of names, addresses, or
    context-dependent identifiers. Upgrade to a real NER-based layer
    (e.g. Microsoft Presidio) before handling real patient data.

Whisper doesn't do speaker diarization, so this pipeline doesn't
pretend to know who said what — every transcript line is labeled
"dictation" rather than a guessed "doctor"/"patient". If per-speaker
attribution matters later, add a diarization step (e.g. pyannote.audio)
in front of this, or have the doctor dictate a summary rather than
recording the whole conversation.

Both external calls need real credentials and were unit-tested against
mocked responses only (see tests/test_ai_pipeline.py) — this sandbox has
no API keys and, in the Google-STT version this replaced, no network
route to the provider either. Whisper/Anthropic calls are reachable
from a normal internet connection; run this on your own machine or
server with real keys in .env to see it work live. See the root
README's "Getting the real AI working" section for exact steps.
"""
import re
from pathlib import Path

import httpx
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.consultation import AIClaim, ClaimCategory, Consultation, ConsultationStatus, TranscriptLine

settings = get_settings()

OPENAI_TRANSCRIPTION_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions"

# --- PII redaction -----------------------------------------------------

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Matches runs of digits with optional +/-/./space separators, at least
# 8 digits total (so short clinical numbers like "101" or "34" are never
# caught) — deliberately loose about grouping since real phone numbers
# are written inconsistently (5+5, 3+3+4, with/without country code).
_PHONE_RE = re.compile(r"(?<!\d)\+?\d(?:[\d\-.\s]{5,16}\d)(?!\d)")
_LONG_ID_RE = re.compile(r"\b\d{9,}\b")  # MRNs, national IDs, etc.


def redact_pii(text: str) -> str:
    """
    Strip high-confidence direct identifiers before sending transcript
    text to an external LLM API. See module docstring for the important
    caveat: this is pattern-based only, not a substitute for a real NER
    redaction layer in production.
    """
    if not settings.pii_redaction_enabled:
        return text
    text = _EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    text = _LONG_ID_RE.sub("[REDACTED_ID]", text)
    text = _PHONE_RE.sub("[REDACTED_PHONE]", text)
    return text


# --- Speech-to-text (OpenAI Whisper) ------------------------------------


async def transcribe_audio(audio_path: str) -> list[dict]:
    """
    Calls OpenAI's Whisper transcription API and returns a list of
    {speaker, text, start_offset_seconds} dicts, one per Whisper
    "segment" (roughly a phrase/sentence, with a timestamp).

    Every entry has speaker="dictation" — Whisper has no diarization, so
    this pipeline doesn't fabricate a doctor/patient split. See the
    module docstring for what a real fix would involve.

    Raises RuntimeError if no API key is configured, or
    httpx.HTTPStatusError if OpenAI's API returns an error.
    """
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured — set it in .env to enable transcription.")

    audio_bytes = Path(audio_path).read_bytes()
    filename = Path(audio_path).name or "audio.webm"

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            OPENAI_TRANSCRIPTION_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            files={"file": (filename, audio_bytes, "application/octet-stream")},
            data={"model": "whisper-1", "response_format": "verbose_json"},
        )
    resp.raise_for_status()
    return _parse_whisper_response(resp.json())


def _parse_whisper_response(data: dict) -> list[dict]:
    """Pulled out of transcribe_audio so it's directly unit-testable
    against a canned Whisper JSON response, with no network call."""
    segments = data.get("segments")

    if segments:
        return [
            {
                "speaker": "dictation",
                "text": seg["text"].strip(),
                "start_offset_seconds": seg.get("start"),
            }
            for seg in segments
            if seg.get("text", "").strip()
        ]

    # Fallback: some responses (or response_format="json") only include
    # the full text with no segment breakdown — treat it as one line
    # rather than losing the transcript entirely.
    full_text = data.get("text", "").strip()
    if full_text:
        return [{"speaker": "dictation", "text": full_text, "start_offset_seconds": None}]

    return []


# --- LLM claim extraction -----------------------------------------------

_CLAIM_TOOL = {
    "name": "record_clinical_claims",
    "description": "Record structured clinical claims extracted from a consultation transcript, each grounded in specific transcript line numbers.",
    "input_schema": {
        "type": "object",
        "properties": {
            "claims": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["summary", "assessment", "investigation", "prescription"],
                        },
                        "text": {"type": "string", "description": "The claim, in clear clinical language."},
                        "source_line_indices": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Transcript line numbers (the [N] markers) that support this claim. Required and non-empty.",
                        },
                        "requires_verification": {
                            "type": "boolean",
                            "description": "True for differential diagnoses or claims involving meaningful clinical uncertainty.",
                        },
                    },
                    "required": ["category", "text", "source_line_indices", "requires_verification"],
                },
            }
        },
        "required": ["claims"],
    },
}

_SYSTEM_PROMPT = (
    "You are a clinical documentation assistant. Read the numbered consultation "
    "transcript and extract structured claims that a doctor will review and either "
    "accept, edit, or reject before they become part of the medical record.\n\n"
    "Rules:\n"
    "- Every claim MUST cite the transcript line numbers that support it. Never "
    "produce a claim without at least one citation, and never cite a line that "
    "doesn't actually support the claim.\n"
    "- Do not include any information that was not stated in the transcript.\n"
    "- Categorize each claim as exactly one of: summary (chief complaint / history), "
    "assessment (clinical impression), investigation (a suggested test or order), or "
    "prescription (a suggested medication, including drug name, dose, frequency, and "
    "duration whenever the transcript states or clearly implies them).\n"
    "- Set requires_verification=true for differential diagnoses or anything involving "
    "meaningful clinical uncertainty, so the reviewing doctor's attention is drawn to it."
)


def _get_anthropic_client() -> Anthropic:
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured — set it in .env to enable claim extraction.")
    return Anthropic(api_key=settings.anthropic_api_key)


async def extract_claims(transcript_lines: list[TranscriptLine]) -> list[dict]:
    """
    Calls the Anthropic API to extract structured clinical claims from the
    transcript, each grounded in specific transcript line ids (PID Section
    7.3). PII is redacted from every line before it's sent (Section 7.1).

    Returns a list of {category, text, requires_verification,
    source_line_ids} dicts — source_line_ids are the real TranscriptLine
    UUIDs, already mapped back from the model's line-number citations.
    Claims whose citations don't resolve to any real line are dropped
    rather than silently persisted ungrounded.
    """
    client = _get_anthropic_client()

    line_id_by_index: dict[int, object] = {}
    numbered_lines = []
    for i, line in enumerate(transcript_lines):
        line_id_by_index[i] = line.id
        numbered_lines.append(f"[{i}] {redact_pii(line.text)}")
    transcript_text = "\n".join(numbered_lines)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Transcript:\n{transcript_text}"}],
        tools=[_CLAIM_TOOL],
        tool_choice={"type": "tool", "name": "record_clinical_claims"},
    )

    return _parse_claim_response(response, line_id_by_index)


def _parse_claim_response(response, line_id_by_index: dict[int, object]) -> list[dict]:
    """Pulled out of extract_claims so it's directly unit-testable against
    a canned Anthropic response object, with no network call."""
    tool_use_block = next((b for b in response.content if b.type == "tool_use"), None)
    if tool_use_block is None:
        raise RuntimeError("Model did not return structured claims (no tool_use block in response).")

    raw_claims = tool_use_block.input.get("claims", [])

    claims = []
    for c in raw_claims:
        source_ids = [line_id_by_index[i] for i in c.get("source_line_indices", []) if i in line_id_by_index]
        if not source_ids:
            continue  # ungrounded claim — drop it rather than let it through
        claims.append(
            {
                "category": c["category"],
                "text": c["text"],
                "requires_verification": c.get("requires_verification", False),
                "source_line_ids": source_ids,
            }
        )
    return claims


# --- Orchestration -------------------------------------------------------


async def transcribe_and_extract(db: Session, consultation: Consultation) -> None:
    """
    Orchestrates the full pipeline for one consultation: transcribe audio,
    persist TranscriptLine rows, extract claims, persist AIClaim rows,
    flip status to READY_FOR_REVIEW. On any failure, marks the
    consultation FAILED with a stored error message rather than leaving
    it stuck at TRANSCRIBING forever, and re-raises so the caller (the
    API route) can return a real error to the client.
    """
    try:
        utterances = await transcribe_audio(consultation.audio_storage_url)

        for i, u in enumerate(utterances):
            db.add(
                TranscriptLine(
                    consultation_id=consultation.id,
                    sequence=i,
                    speaker=u["speaker"],
                    text=u["text"],
                    start_offset_seconds=u.get("start_offset_seconds"),
                )
            )
        db.commit()
        db.refresh(consultation)

        claims = await extract_claims(consultation.transcript_lines)
        for c in claims:
            db.add(
                AIClaim(
                    consultation_id=consultation.id,
                    category=ClaimCategory(c["category"]),
                    text=c["text"],
                    requires_verification=c.get("requires_verification", False),
                    source_line_ids=c.get("source_line_ids", []),
                )
            )

        consultation.status = ConsultationStatus.READY_FOR_REVIEW
        db.commit()

    except Exception as exc:
        db.rollback()
        consultation.status = ConsultationStatus.FAILED
        consultation.error_message = str(exc)
        db.commit()
        raise
