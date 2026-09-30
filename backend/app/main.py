from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, consultations, facilities, orders, patients

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="API for the AI-assisted clinical consultation & healthcare workflow platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(patients.router, prefix=settings.api_prefix)
app.include_router(facilities.router, prefix=settings.api_prefix)
app.include_router(consultations.router, prefix=settings.api_prefix)
app.include_router(orders.router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok", "environment": settings.environment}
