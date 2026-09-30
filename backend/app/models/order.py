import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    DISPATCHED = "dispatched"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class Prescription(Base):
    """
    An approved medication order, dispatched to a pharmacy. Maps to a
    FHIR MedicationRequest resource on dispatch (PID Section 9).
    """

    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("consultations.id"), nullable=False
    )
    source_claim_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_claims.id"), nullable=True
    )

    drug_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dose: Mapped[str] = mapped_column(String(64), nullable=False)
    route: Mapped[str] = mapped_column(String(32), nullable=False)
    frequency: Mapped[str] = mapped_column(String(64), nullable=False)
    duration: Mapped[str] = mapped_column(String(64), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    pharmacy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("facilities.id"), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="prescription_status"), default=OrderStatus.PENDING, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consultation: Mapped["Consultation"] = relationship(back_populates="prescriptions")


class DiagnosticOrder(Base):
    """
    An approved investigation/test order, dispatched to a lab. Maps to a
    FHIR ServiceRequest resource on dispatch. Results are attached back
    by facility staff via the lab portal (PID Section 9).
    """

    __tablename__ = "diagnostic_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("consultations.id"), nullable=False
    )
    source_claim_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_claims.id"), nullable=True
    )

    test_name: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="routine")  # routine | urgent

    lab_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("facilities.id"), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="diagnostic_order_status"), default=OrderStatus.PENDING, nullable=False
    )

    result_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_file_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consultation: Mapped["Consultation"] = relationship(back_populates="orders")
