import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.consultation import ClaimCategory, ClaimDecision, ConsultationStatus


class ConsultationCreate(BaseModel):
    patient_id: uuid.UUID
    chief_complaint: str | None = None


class TranscriptLineOut(BaseModel):
    id: uuid.UUID
    sequence: int
    speaker: str
    text: str
    start_offset_seconds: float | None = None

    model_config = {"from_attributes": True}


class TranscriptLineIngest(BaseModel):
    """Shape used by the speech-to-text service to push completed lines."""

    sequence: int
    speaker: str
    text: str
    start_offset_seconds: float | None = None


class AIClaimOut(BaseModel):
    id: uuid.UUID
    category: ClaimCategory
    text: str
    edited_text: str | None
    decision: ClaimDecision
    requires_verification: bool
    source_line_ids: list[uuid.UUID]

    model_config = {"from_attributes": True}


class AIClaimDecisionUpdate(BaseModel):
    decision: ClaimDecision
    edited_text: str | None = None
    """Required when decision == EDITED."""


class ConsultationSummary(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    status: ConsultationStatus
    chief_complaint: str | None
    started_at: datetime

    model_config = {"from_attributes": True}


class ConsultationDetail(ConsultationSummary):
    transcript_lines: list[TranscriptLineOut] = []
    claims: list[AIClaimOut] = []
    approved_at: datetime | None
    dispatched_at: datetime | None

    model_config = {"from_attributes": True}


class ConsultationApproveResponse(BaseModel):
    consultation_id: uuid.UUID
    status: ConsultationStatus
    approved_claim_count: int
