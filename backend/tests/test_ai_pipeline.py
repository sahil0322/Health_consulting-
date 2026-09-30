"""
Unit tests for app/services/ai_pipeline.py.

These test the parsing and orchestration logic WITHOUT calling the real
OpenAI Whisper or Anthropic APIs — both are mocked. This proves the code
correctly handles realistic API responses (including edge cases like
ungrounded claims and missing segment data) even though it hasn't been
exercised against the live external services in this environment (no
real API keys here — see the ai_pipeline.py module docstring; run it on
your own machine with real keys to see it work live).

Run with: pytest tests/test_ai_pipeline.py -v
"""
import uuid
from types import SimpleNamespace

import pytest

from app.services import ai_pipeline


# --- redact_pii ----------------------------------------------------------


def test_redact_pii_removes_email():
    text = "Please reach me at patient@example.com if needed."
    result = ai_pipeline.redact_pii(text)
    assert "patient@example.com" not in result
    assert "[REDACTED_EMAIL]" in result


def test_redact_pii_removes_phone_number():
    text = "Call me at +91 98765 43210 tomorrow."
    result = ai_pipeline.redact_pii(text)
    assert "98765 43210" not in result
    assert "[REDACTED_PHONE]" in result


def test_redact_pii_removes_long_id():
    text = "Patient MRN is 123456789012."
    result = ai_pipeline.redact_pii(text)
    assert "123456789012" not in result
    assert "[REDACTED_ID]" in result


def test_redact_pii_leaves_clinical_numbers_alone():
    """Short numbers (temperatures, doses, ages) shouldn't get caught by
    the phone/ID patterns — these are exactly the kind of clinical detail
    that must NOT be redacted."""
    text = "Temperature this morning was 101, patient is 34 years old."
    result = ai_pipeline.redact_pii(text)
    assert "101" in result
    assert "34" in result


def test_redact_pii_disabled_via_settings(monkeypatch):
    monkeypatch.setattr(ai_pipeline.settings, "pii_redaction_enabled", False)
    text = "Email me at patient@example.com"
    assert ai_pipeline.redact_pii(text) == text


# --- _parse_whisper_response ---------------------------------------------


def test_parse_whisper_response_uses_segments():
    """Realistic Whisper verbose_json shape: a list of timestamped
    segments, each roughly a phrase or sentence."""
    data = {
        "text": "What brings you in today? I've had a sore throat and fever.",
        "segments": [
            {"start": 0.0, "end": 1.8, "text": " What brings you in today?"},
            {"start": 2.1, "end": 4.6, "text": " I've had a sore throat and fever."},
        ],
    }

    lines = ai_pipeline._parse_whisper_response(data)

    assert len(lines) == 2
    assert lines[0]["speaker"] == "dictation"
    assert lines[0]["text"] == "What brings you in today?"
    assert lines[0]["start_offset_seconds"] == 0.0
    assert lines[1]["text"] == "I've had a sore throat and fever."
    assert lines[1]["start_offset_seconds"] == 2.1


def test_parse_whisper_response_skips_empty_segments():
    data = {
        "segments": [
            {"start": 0.0, "end": 0.5, "text": "   "},
            {"start": 0.5, "end": 2.0, "text": "Real content here."},
        ]
    }
    lines = ai_pipeline._parse_whisper_response(data)
    assert len(lines) == 1
    assert lines[0]["text"] == "Real content here."


def test_parse_whisper_response_falls_back_to_full_text():
    """If segments are missing (e.g. response_format="json" instead of
    "verbose_json"), fall back to the plain text rather than losing the
    transcript entirely."""
    data = {"text": "Hello there, this is the whole transcript."}
    lines = ai_pipeline._parse_whisper_response(data)
    assert len(lines) == 1
    assert lines[0]["text"] == "Hello there, this is the whole transcript."
    assert lines[0]["start_offset_seconds"] is None


def test_parse_whisper_response_empty_input_returns_empty():
    assert ai_pipeline._parse_whisper_response({}) == []
    assert ai_pipeline._parse_whisper_response({"segments": [], "text": ""}) == []


# --- _parse_claim_response -------------------------------------------------


def _fake_tool_use_response(claims_payload):
    """Builds an object shaped enough like an Anthropic Message to
    exercise _parse_claim_response without needing the real SDK types."""
    tool_block = SimpleNamespace(type="tool_use", input={"claims": claims_payload})
    return SimpleNamespace(content=[tool_block])


def test_parse_claim_response_maps_indices_to_real_line_ids():
    line_ids = {0: uuid.uuid4(), 1: uuid.uuid4(), 2: uuid.uuid4()}
    response = _fake_tool_use_response(
        [
            {
                "category": "summary",
                "text": "Sore throat and fever for 18 hours.",
                "source_line_indices": [0, 1],
                "requires_verification": False,
            }
        ]
    )

    claims = ai_pipeline._parse_claim_response(response, line_ids)

    assert len(claims) == 1
    assert claims[0]["category"] == "summary"
    assert claims[0]["source_line_ids"] == [line_ids[0], line_ids[1]]
    assert claims[0]["requires_verification"] is False


def test_parse_claim_response_drops_ungrounded_claims():
    """A claim citing only line indices that don't exist in this
    transcript must be dropped, not silently persisted with an empty or
    partial grounding — this is the core safety property from PID
    Section 7.3."""
    line_ids = {0: uuid.uuid4()}
    response = _fake_tool_use_response(
        [
            {
                "category": "assessment",
                "text": "Ungrounded claim citing a line that doesn't exist.",
                "source_line_indices": [5, 6],
                "requires_verification": False,
            },
            {
                "category": "summary",
                "text": "Grounded claim.",
                "source_line_indices": [0],
                "requires_verification": False,
            },
        ]
    )

    claims = ai_pipeline._parse_claim_response(response, line_ids)

    assert len(claims) == 1
    assert claims[0]["text"] == "Grounded claim."


def test_parse_claim_response_raises_without_tool_use_block():
    response = SimpleNamespace(content=[SimpleNamespace(type="text", text="I couldn't extract structured claims.")])
    with pytest.raises(RuntimeError, match="did not return structured claims"):
        ai_pipeline._parse_claim_response(response, {})


def test_parse_claim_response_partial_indices_still_grounds():
    """If the model cites one real index and one bogus one, keep the
    claim (it IS grounded, just not maximally) rather than drop it —
    only claims with ZERO valid citations should be dropped."""
    line_ids = {0: uuid.uuid4()}
    response = _fake_tool_use_response(
        [
            {
                "category": "investigation",
                "text": "Order a rapid strep test.",
                "source_line_indices": [0, 99],
                "requires_verification": False,
            }
        ]
    )
    claims = ai_pipeline._parse_claim_response(response, line_ids)
    assert len(claims) == 1
    assert claims[0]["source_line_ids"] == [line_ids[0]]


def test_parse_claim_response_captures_prescription_details():
    """Prescription claims should read as complete clinical text (drug,
    dose, frequency, duration) since the frontend's OrderPreview shows
    claim.text directly — there's no separate structured drug/dose
    field at extraction time."""
    line_ids = {0: uuid.uuid4()}
    response = _fake_tool_use_response(
        [
            {
                "category": "prescription",
                "text": "Amoxicillin 500mg, twice daily, 10 days, pending RADT confirmation.",
                "source_line_indices": [0],
                "requires_verification": True,
            }
        ]
    )
    claims = ai_pipeline._parse_claim_response(response, line_ids)
    assert claims[0]["category"] == "prescription"
    assert "500mg" in claims[0]["text"]
    assert claims[0]["requires_verification"] is True


# --- extract_claims / transcribe_audio guard clauses -----------------------


@pytest.mark.asyncio
async def test_extract_claims_raises_without_api_key(monkeypatch):
    monkeypatch.setattr(ai_pipeline.settings, "anthropic_api_key", None)
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        await ai_pipeline.extract_claims([])


@pytest.mark.asyncio
async def test_transcribe_audio_raises_without_api_key(monkeypatch):
    monkeypatch.setattr(ai_pipeline.settings, "openai_api_key", None)
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        await ai_pipeline.transcribe_audio("/tmp/does-not-matter.webm")
