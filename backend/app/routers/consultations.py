import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.consultation import AIClaim, ClaimDecision, Consultation, ConsultationStatus
from app.models.user import User
from app.schemas.consultation import (
    AIClaimDecisionUpdate,
    AIClaimOut,
    ConsultationApproveResponse,
    ConsultationCreate,
    ConsultationDetail,
    ConsultationSummary,
)
from app.services import ai_pipeline, storage

router = APIRouter(prefix="/consultations", tags=["consultations"])


@router.get("", response_model=list[ConsultationSummary])
def list_todays_queue(
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
) -> list[Consultation]:
    """Backs the patient queue in DoctorDashboard.jsx (left pane)."""
    stmt = (
        select(Consultation)
        .where(Consultation.doctor_id == doctor.id)
        .order_by(Consultation.started_at.desc())
        .limit(50)
    )
    return list(db.scalars(stmt))


@router.post("", response_model=ConsultationSummary, status_code=status.HTTP_201_CREATED)
def start_consultation(
    payload: ConsultationCreate,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
) -> Consultation:
    """Backs the 'Start recording' action in ConsultRecorder.jsx."""
    consultation = Consultation(
        patient_id=payload.patient_id,
        doctor_id=doctor.id,
        chief_complaint=payload.chief_complaint,
        status=ConsultationStatus.RECORDING,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    return consultation


@router.get("/{consultation_id}", response_model=ConsultationDetail)
def get_consultation(
    consultation_id: uuid.UUID,
    db: Session = Depends(get_db),
    _doctor: User = Depends(require_role("doctor")),
) -> Consultation:
    """Backs the review pane + transcript pane in DoctorDashboard.jsx."""
    consultation = db.get(Consultation, consultation_id)
    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return consultation


@router.post("/{consultation_id}/audio", response_model=ConsultationSummary)
async def upload_audio(
    consultation_id: uuid.UUID,
    file: UploadFile,
    db: Session = Depends(get_db),
    _doctor: User = Depends(require_role("doctor")),
) -> Consultation:
    """
    Backs the 'Finish recording' / 'Upload audio' actions in
    ConsultRecorder.jsx. Stores the audio, then kicks off transcription.

    In production this should hand off to a background worker (Celery /
    arq) rather than blocking the request — transcription of a 10-minute
    consultation is not a sub-second operation. Stubbed as a direct call
    here for clarity; see app/services/ai_pipeline.py.
    """
    consultation = db.get(Consultation, consultation_id)
    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    consultation.status = ConsultationStatus.PROCESSING
    db.commit()

    audio_url = await storage.save_audio(consultation_id, file)
    consultation.audio_storage_url = audio_url
    consultation.status = ConsultationStatus.TRANSCRIBING
    db.commit()

    try:
        # Populates TranscriptLine rows and generates AIClaim rows, then
        # flips status to READY_FOR_REVIEW. On failure it marks the
        # consultation FAILED with an error message and re-raises here.
        await ai_pipeline.transcribe_and_extract(db, consultation)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Audio was uploaded, but transcription/extraction failed: {exc}",
        ) from exc

    db.refresh(consultation)
    return consultation


@router.patch("/{consultation_id}/claims/{claim_id}", response_model=AIClaimOut)
def update_claim_decision(
    consultation_id: uuid.UUID,
    claim_id: uuid.UUID,
    payload: AIClaimDecisionUpdate,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role("doctor")),
) -> AIClaim:
    """
    Backs the Accept / Edit / Reject buttons on each claim card in
    DoctorDashboard.jsx.
    """
    claim = db.get(AIClaim, claim_id)
    if claim is None or claim.consultation_id != consultation_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

    if payload.decision == ClaimDecision.EDITED and not payload.edited_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="edited_text is required when decision is 'edited'")

    claim.decision = payload.decision
    claim.edited_text = payload.edited_text if payload.decision == ClaimDecision.EDITED else None
    claim.decided_by_id = doctor.id
    claim.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(claim)
    return claim


@router.post("/{consultation_id}/approve", response_model=ConsultationApproveResponse)
def approve_consultation(
    consultation_id: uuid.UUID,
    db: Session = Depends(get_db),
    _doctor: User = Depends(require_role("doctor")),
) -> ConsultationApproveResponse:
    """
    Backs 'Approve and dispatch' in DoctorDashboard.jsx. Requires every
    claim to have a decision before allowing approval — mirrors the
    frontend's disabled-button gate, enforced again here since the
    frontend check alone isn't trustworthy.
    """
    consultation = db.get(Consultation, consultation_id)
    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    undecided = [c for c in consultation.claims if c.decision == ClaimDecision.PENDING]
    if undecided:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{len(undecided)} claim(s) still need a decision before approval.",
        )

    consultation.status = ConsultationStatus.APPROVED
    consultation.approved_at = datetime.utcnow()
    db.commit()

    accepted_count = sum(1 for c in consultation.claims if c.decision != ClaimDecision.REJECTED)
    return ConsultationApproveResponse(
        consultation_id=consultation.id,
        status=consultation.status,
        approved_claim_count=accepted_count,
    )
