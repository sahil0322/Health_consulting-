import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.consultation import ClaimDecision, Consultation, ConsultationStatus
from app.models.order import DiagnosticOrder, OrderStatus, Prescription
from app.models.user import User
from app.schemas.order import (
    DiagnosticOrderOut,
    DispatchRequest,
    OrderQueueItem,
    PrescriptionOut,
    ResultSubmission,
)
from app.services import fhir_dispatch

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/consultations/{consultation_id}/dispatch", status_code=status.HTTP_200_OK)
def dispatch_orders(
    consultation_id: uuid.UUID,
    payload: DispatchRequest,
    db: Session = Depends(get_db),
    _doctor: User = Depends(require_role("doctor")),
) -> dict:
    """
    Backs 'Confirm and dispatch' in OrderPreview.jsx. Builds FHIR
    MedicationRequest / ServiceRequest resources from the approved claims
    and sends them to the chosen facilities (PID Section 9).

    Consultation must already be APPROVED (see consultations.approve_consultation)
    — dispatch is a distinct, later step, matching the two-screen flow in
    the frontend (review -> approve, then a separate order-preview screen).
    """
    consultation = db.get(Consultation, consultation_id)
    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    if consultation.approved_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consultation must be approved before dispatch")

    accepted_claims = [c for c in consultation.claims if c.decision != ClaimDecision.REJECTED]

    # Build Prescription / DiagnosticOrder rows from accepted claims.
    # (Real extraction of drug/dose/frequency from claim text belongs in
    # ai_pipeline — stubbed as a pass-through here.)
    for claim in accepted_claims:
        if claim.category.value == "prescription":
            db.add(
                Prescription(
                    consultation_id=consultation.id,
                    source_claim_id=claim.id,
                    drug_name="TBD — parsed from claim text",
                    dose="TBD",
                    route="Oral",
                    frequency="TBD",
                    duration="TBD",
                    pharmacy_id=payload.pharmacy_id,
                    status=OrderStatus.DISPATCHED,
                    dispatched_at=datetime.utcnow(),
                )
            )
        elif claim.category.value == "investigation":
            db.add(
                DiagnosticOrder(
                    consultation_id=consultation.id,
                    source_claim_id=claim.id,
                    test_name=claim.edited_text or claim.text,
                    lab_id=payload.lab_id,
                    status=OrderStatus.DISPATCHED,
                    dispatched_at=datetime.utcnow(),
                )
            )

    db.commit()

    fhir_dispatch.send_bundle(consultation)  # fire-and-log; real impl should retry/queue

    consultation.status = ConsultationStatus.DISPATCHED
    consultation.dispatched_at = datetime.utcnow()
    db.commit()

    return {"consultation_id": str(consultation_id), "dispatched": True}


@router.get("/facility/queue", response_model=list[OrderQueueItem])
def facility_order_queue(
    db: Session = Depends(get_db),
    staff: User = Depends(require_role("facility_staff")),
) -> list[OrderQueueItem]:
    """
    Backs FacilityPortal.jsx's incoming-orders list, scoped to the logged-in
    staff member's facility.
    """
    if staff.facility_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is not linked to a facility")

    items: list[OrderQueueItem] = []

    rx_stmt = select(Prescription).where(Prescription.pharmacy_id == staff.facility_id)
    for rx in db.scalars(rx_stmt):
        items.append(
            OrderQueueItem(
                id=rx.id,
                kind="pharmacy",
                patient_name=rx.consultation.patient.full_name,
                item_description=f"{rx.drug_name} {rx.dose} \u00b7 {rx.frequency} \u00b7 {rx.duration}",
                ordered_by=rx.consultation.doctor.full_name,
                status=rx.status,
                created_at=rx.created_at,
            )
        )

    lab_stmt = select(DiagnosticOrder).where(DiagnosticOrder.lab_id == staff.facility_id)
    for order in db.scalars(lab_stmt):
        items.append(
            OrderQueueItem(
                id=order.id,
                kind="lab",
                patient_name=order.consultation.patient.full_name,
                item_description=order.test_name,
                ordered_by=order.consultation.doctor.full_name,
                status=order.status,
                created_at=order.created_at,
            )
        )

    items.sort(key=lambda i: i.created_at, reverse=True)
    return items


@router.post("/prescriptions/{prescription_id}/fulfill", response_model=PrescriptionOut)
def fulfill_prescription(
    prescription_id: uuid.UUID,
    db: Session = Depends(get_db),
    staff: User = Depends(require_role("facility_staff")),
) -> Prescription:
    """Backs 'Mark fulfilled' for a pharmacy row in FacilityPortal.jsx."""
    rx = db.get(Prescription, prescription_id)
    if rx is None or rx.pharmacy_id != staff.facility_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")
    rx.status = OrderStatus.FULFILLED
    rx.fulfilled_at = datetime.utcnow()
    db.commit()
    db.refresh(rx)
    return rx


@router.post("/diagnostic-orders/{order_id}/result", response_model=DiagnosticOrderOut)
def submit_result(
    order_id: uuid.UUID,
    payload: ResultSubmission,
    db: Session = Depends(get_db),
    staff: User = Depends(require_role("facility_staff")),
) -> DiagnosticOrder:
    """Backs 'Attach result' for a lab row in FacilityPortal.jsx."""
    order = db.get(DiagnosticOrder, order_id)
    if order is None or order.lab_id != staff.facility_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic order not found")
    order.result_text = payload.result_text
    order.result_file_url = payload.result_file_url
    order.status = OrderStatus.FULFILLED
    order.fulfilled_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order
