import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ConsultationStatus(str, enum.Enum):
    """Mirrors the pipeline stages shown in the frontend status badges."""

    RECORDING = "recording"
    PROCESSING = "processing"
    TRANSCRIBING = "transcribing"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    DISPATCHED = "dispatched"
    FAILED = "failed"


class Consultation(Base):
    """
    One doctor-patient encounter. This is the spine of the whole workflow:
    Consultation -> TranscriptLine(s) -> AIClaim(s) -> Prescription /
    DiagnosticOrder, matching the pipeline in PID Section 3.
    """

    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    status: Mapped[ConsultationStatus] = mapped_column(
        Enum(ConsultationStatus, name="consultation_status"),
        default=ConsultationStatus.RECORDING,
        nullable=False,
    )
    chief_complaint: Mapped[str | None] = mapped_column(String(500), nullable=True)

    audio_storage_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    audio_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped["Patient"] = relationship(back_populates="consultations")
    transcript_lines: Mapped[list["TranscriptLine"]] = relationship(
        back_populates="consultation", order_by="TranscriptLine.sequence", cascade="all, delete-orphan"
    )
    claims: Mapped[list["AIClaim"]] = relationship(back_populates="consultation", cascade="all, delete-orphan")
    orders: Mapped[list["DiagnosticOrder"]] = relationship(back_populates="consultation", cascade="all, delete-orphan")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="consultation", cascade="all, delete-orphan")

    @property
    def patient_name(self) -> str:
        """Convenience accessor so ConsultationSummary can serialize a
        display name without every caller needing a manual join."""
        return self.patient.full_name


class TranscriptLine(Base):
    """One utterance in the consultation transcript. Sequence-ordered."""

    __tablename__ = "transcript_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("consultations.id"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)  # "doctor" | "patient"
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_offset_seconds: Mapped[float | None] = mapped_column(nullable=True)

    consultation: Mapped["Consultation"] = relationship(back_populates="transcript_lines")


class ClaimCategory(str, enum.Enum):
    SUMMARY = "summary"
    ASSESSMENT = "assessment"
    INVESTIGATION = "investigation"
    PRESCRIPTION = "prescription"


class ClaimDecision(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EDITED = "edited"
    REJECTED = "rejected"


class AIClaim(Base):
    """
    A single AI-generated statement (clinical summary line, assessment,
    suggested investigation, or draft prescription item), grounded in one
    or more transcript lines. This is the human-in-the-loop unit from PID
    Section 6/7.3 — nothing here becomes clinically actionable until
    `decision` is ACCEPTED or EDITED by the doctor.
    """

    __tablename__ = "ai_claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("consultations.id"), nullable=False
    )
    category: Mapped[ClaimCategory] = mapped_column(Enum(ClaimCategory, name="claim_category"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    edited_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    decision: Mapped[ClaimDecision] = mapped_column(
        Enum(ClaimDecision, name="claim_decision"), default=ClaimDecision.PENDING, nullable=False
    )
    requires_verification: Mapped[bool] = mapped_column(default=False)  # e.g. differential diagnoses

    # Grounding: which transcript lines this claim was derived from
    # (PID Section 7.3 — traceability of AI output back to source audio).
    source_line_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)

    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consultation: Mapped["Consultation"] = relationship(back_populates="claims")
