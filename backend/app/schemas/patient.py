import uuid
from datetime import date, datetime

from pydantic import BaseModel


class PatientBase(BaseModel):
    full_name: str
    date_of_birth: date
    sex: str
    phone: str | None = None
    address: str | None = None
    blood_group: str | None = None
    allergies: list[str] = []
    chronic_conditions: list[str] = []
    current_medications: list[str] = []


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    phone: str | None = None
    address: str | None = None
    blood_group: str | None = None
    allergies: list[str] | None = None
    chronic_conditions: list[str] | None = None
    current_medications: list[str] | None = None


class PatientSummary(BaseModel):
    """Lightweight shape for directory/search listings."""

    id: uuid.UUID
    full_name: str
    date_of_birth: date
    sex: str
    phone: str | None

    model_config = {"from_attributes": True}


class PatientDetail(PatientBase):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
