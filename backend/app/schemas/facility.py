import uuid

from pydantic import BaseModel


class FacilityOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: str
    address: str | None

    model_config = {"from_attributes": True}
