from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.facility import Facility
from app.schemas.facility import FacilityOut

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("", response_model=list[FacilityOut])
def list_facilities(
    kind: str | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("doctor", "admin")),
) -> list[Facility]:
    """Backs the pharmacy/lab dropdowns in OrderPreview.jsx."""
    stmt = select(Facility)
    if kind:
        stmt = stmt.where(Facility.kind == kind)
    stmt = stmt.order_by(Facility.name)
    return list(db.scalars(stmt))
