"""
Import every model module here so Base.metadata sees all tables —
Alembic's autogenerate and Base.metadata.create_all() both rely on this.
"""
from app.models.user import User  # noqa: F401
from app.models.facility import Facility  # noqa: F401
from app.models.patient import Patient  # noqa: F401
from app.models.consultation import (  # noqa: F401
    Consultation,
    ConsultationStatus,
    TranscriptLine,
    AIClaim,
    ClaimCategory,
    ClaimDecision,
)
from app.models.order import Prescription, DiagnosticOrder, OrderStatus  # noqa: F401
