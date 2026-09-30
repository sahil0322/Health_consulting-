"""
Audio file storage — currently a local-disk stub. Swap for S3 /
Google Cloud Storage / Azure Blob in production; the PID's tech stack
(Section 5) specifies "Cloud/Object Storage" generically, so keep this
interface provider-agnostic.
"""
import uuid
from pathlib import Path

from fastapi import UploadFile

LOCAL_STORAGE_DIR = Path("./var/audio")


async def save_audio(consultation_id: uuid.UUID, file: UploadFile) -> str:
    """
    Persists the uploaded audio and returns a storage URL/path.

    Replace with a real object-storage upload (e.g. boto3 S3 client) —
    this local implementation exists only so the API is runnable without
    cloud credentials during early development.
    """
    LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    dest = LOCAL_STORAGE_DIR / f"{consultation_id}{suffix}"

    contents = await file.read()
    dest.write_bytes(contents)

    return str(dest)
