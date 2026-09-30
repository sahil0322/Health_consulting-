import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.order import OrderStatus


class DispatchRequest(BaseModel):
    """Sent when the doctor confirms the order preview screen."""

    pharmacy_id: uuid.UUID | None = None
    lab_id: uuid.UUID | None = None


class PrescriptionOut(BaseModel):
    id: uuid.UUID
    drug_name: str
    dose: str
    route: str
    frequency: str
    duration: str
    note: str | None
    status: OrderStatus
    pharmacy_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class DiagnosticOrderOut(BaseModel):
    id: uuid.UUID
    test_name: str
    priority: str
    status: OrderStatus
    lab_id: uuid.UUID | None
    result_text: str | None
    result_file_url: str | None

    model_config = {"from_attributes": True}


class OrderQueueItem(BaseModel):
    """Row shape for the facility portal's incoming-orders list."""

    id: uuid.UUID
    kind: str  # "lab" | "pharmacy"
    patient_name: str
    item_description: str
    ordered_by: str
    status: OrderStatus
    created_at: datetime


class ResultSubmission(BaseModel):
    result_text: str | None = None
    result_file_url: str | None = None
