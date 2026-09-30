import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.consultation import Consultation
from app.models.patient import Patient
from app.schemas.consultation import ConsultationSummary
from app.schemas.patient import PatientCreate, PatientDetail, PatientSummary, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[PatientSummary])
def list_patients(
    q: str | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("doctor", "admin")),
) -> list[Patient]:
    """Backs PatientSearch.jsx — `q` filters by name or phone."""
    stmt = select(Patient)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Patient.full_name.ilike(like), Patient.phone.ilike(like)))
    stmt = stmt.order_by(Patient.full_name).limit(100)
    return list(db.scalars(stmt))


@router.post("", response_model=PatientDetail, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("doctor", "admin")),
) -> Patient:
    patient = Patient(**payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("doctor", "admin")),
) -> Patient:
    """Backs the demographics panel in PatientDetail.jsx."""
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


@router.patch("/{patient_id}", response_model=PatientDetail)
def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("doctor", "admin")),
) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{patient_id}/consultations", response_model=list[ConsultationSummary])
def get_patient_consultation_history(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("doctor", "admin")),
) -> list[Consultation]:
    """Backs the 'Visit history' tab in PatientDetail.jsx."""
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    stmt = (
        select(Consultation)
        .where(Consultation.patient_id == patient_id)
        .order_by(Consultation.started_at.desc())
    )
    return list(db.scalars(stmt))
