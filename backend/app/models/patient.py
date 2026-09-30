import uuid
from datetime import date, datetime

from sqlalchemy import ARRAY, Date, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Patient(Base):
    """
    Structured patient record (PID Section 4.1, objective 10: "Maintain
    structured patient records using PostgreSQL").
    """

    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    sex: Mapped[str] = mapped_column(String(16), nullable=False)  # "male" | "female" | "other"
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(8), nullable=True)

    allergies: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    chronic_conditions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    current_medications: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    consultations: Mapped[list["Consultation"]] = relationship(back_populates="patient")
