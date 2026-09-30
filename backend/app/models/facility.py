import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Facility(Base):
    """A pharmacy or diagnostic lab that can receive dispatched orders."""

    __tablename__ = "facilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # "pharmacy" | "lab"
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fhir_endpoint_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    staff: Mapped[list["User"]] = relationship(back_populates="facility")
