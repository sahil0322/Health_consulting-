import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    """
    A platform account. `role` distinguishes doctors (who use the review
    workflow) from facility staff (who use the lab/pharmacy portal) and
    admins. See PID Section 9 for the two distinct user journeys.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="doctor")
    # role in {"doctor", "facility_staff", "admin"}

    # Set only for role == "facility_staff" — which lab/pharmacy this
    # account belongs to, for scoping the order queue.
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("facilities.id"), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    facility: Mapped["Facility | None"] = relationship(back_populates="staff")
