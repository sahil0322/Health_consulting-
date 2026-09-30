# Consult API

FastAPI backend for the AI-Assisted Clinical Consultation & Healthcare
Workflow Management System (see the Project Initiation Document).

## Stack

- FastAPI + Uvicorn
- SQLAlchemy 2.0 + PostgreSQL
- Alembic for migrations
- JWT auth (python-jose / PyJWT)

## Project layout

```
app/
  core/          config, DB session, security (hashing/JWT), auth dependencies
  models/        SQLAlchemy models (User, Patient, Consultation, TranscriptLine,
                 AIClaim, Prescription, DiagnosticOrder, Facility)
  schemas/       Pydantic request/response shapes
  routers/       API endpoints, grouped by resource
  services/      Business logic that isn't just CRUD:
                   - ai_pipeline.py   speech-to-text + LLM claim extraction (STUB)
                   - fhir_dispatch.py builds/sends FHIR bundles to facilities (STUB)
                   - storage.py       audio file storage (local-disk STUB)
  main.py        FastAPI app instance, router wiring, CORS
  seed.py        populates dev DB with data matching the frontend mocks
alembic/         migration environment
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET_KEY, and any AI provider keys

# create the database tables (dev shortcut — use Alembic migrations for
# anything beyond local development)
python -m app.seed

uvicorn app.main:app --reload
```

API docs at `http://localhost:8000/docs` once running.

## How this maps to the frontend

| Frontend screen        | Backend routes                                                        |
|-------------------------|-------------------------------------------------------------------------|
| `LoginScreen`           | `POST /api/auth/login`, `GET /api/auth/me`                             |
| `PatientSearch`         | `GET /api/patients?q=`                                                 |
| `PatientDetail`         | `GET /api/patients/{id}`, `PATCH /api/patients/{id}`                    |
| `DoctorDashboard`       | `GET /api/consultations`, `GET /api/consultations/{id}`, `PATCH .../claims/{claim_id}`, `POST .../approve` |
| `ConsultRecorder`       | `POST /api/consultations`, `POST /api/consultations/{id}/audio`         |
| `OrderPreview`          | `POST /api/orders/consultations/{id}/dispatch`                          |
| `FacilityPortal`        | `GET /api/orders/facility/queue`, `POST /api/orders/prescriptions/{id}/fulfill`, `POST /api/orders/diagnostic-orders/{id}/result` |

## AI pipeline — now real, not a stub

`services/ai_pipeline.py` has real implementations:

- **`redact_pii()`** — regex-based redaction of emails, phone numbers,
  and long ID-like digit sequences, run on every transcript line before
  it's sent to the LLM. This is a **basic, pattern-based floor, not a
  complete solution** — it has no concept of names, addresses, or
  context-dependent identifiers. Upgrade to a real NER-based layer (e.g.
  Microsoft Presidio) before handling real patient data.
- **`transcribe_audio()`** — calls OpenAI's Whisper API
  (`/v1/audio/transcriptions`, `response_format=verbose_json`) and
  returns segment-level timestamped lines. Chosen over Google Cloud
  Speech-to-Text deliberately: it needs only an API key (no GCP project,
  billing account, or service-account JSON), which matters if you're
  trying to actually get this running rather than just reading the code.
  Whisper has no speaker diarization, so every line is labeled
  `"dictation"` rather than a guessed doctor/patient split — no fake
  capability is implied.
- **`extract_claims()`** — calls the Anthropic API with a tool-use schema
  that forces every claim to cite the transcript line numbers it's
  grounded in (PID Section 7.3). Claims citing no valid line are dropped
  before they ever reach the database, not just filtered in the UI.

**Both external calls need real credentials** (`OPENAI_API_KEY`,
`ANTHROPIC_API_KEY` in `.env`). This development environment has neither
and has no outbound network access to either provider's API, so the
parsing and orchestration logic is proven correct via **16 mocked unit
tests** (`tests/test_ai_pipeline.py`, all passing — run `pytest`),
covering realistic API response shapes, ungrounded-claim rejection,
missing segment data, and the redaction regex (which caught and fixed a
real bug: the original phone-number pattern missed "98765 43210"-style
groupings). That sandbox restriction does not apply to a normal machine
with internet access — see the root README's "Getting the real AI
working" section for exact steps to run this for real, live, with your
own keys. The orchestration was also verified end-to-end against the
real database and API here — uploading audio with no keys configured
correctly returns `502` with a specific message and leaves the
consultation in a `FAILED` state (with `error_message` set) rather than
hanging at "transcribing" forever.

## What's still stubbed, not implemented

1. **`services/fhir_dispatch.py`** — logs instead of sending. Needs real
   FHIR resource construction and delivery with retry/dead-letter
   handling — a silent dispatch failure here is the worst failure mode
   in the system (a doctor believes an order went out; it didn't).
2. **`services/storage.py`** — writes to local disk. Needs a real
   object-storage backend (S3 / GCS / Azure Blob) before deployment.
3. **Audio transcription is currently synchronous** inside the upload
   request (`routers/consultations.py: upload_audio`). This should move
   to a background worker (Celery, arq, or similar) — a multi-minute
   consultation shouldn't block an HTTP request.
4. **No rate limiting, no audit logging, no MFA** — all implied by PID
   Section 7.1 (privacy/security) but out of scope for this skeleton.

## Auth notes

Two roles are modeled: `doctor` (dashboard, recorder, patient screens)
and `facility_staff` (lab/pharmacy portal, scoped to `User.facility_id`).
A third, `admin`, is referenced in a couple of route guards but has no
dedicated screens yet.

## Verified working (this session)

Ran against a real local PostgreSQL 16 instance:
- `python -m app.seed` created all tables and inserted seed data.
- `uvicorn app.main:app` started successfully.
- Full workflow tested end-to-end via curl, exactly as the frontend
  calls it: login -> queue (with patient_name) -> claim decision ->
  approve -> facilities list -> consultation history -> dispatch.
- Added two routes needed once the frontend was wired for real:
  `GET /api/patients/{id}/consultations` (visit history tab) and
  `GET /api/facilities?kind=` (pharmacy/lab dropdowns).
- Added `patient_name` to `ConsultationSummary` so the queue list can
  render a name without a separate lookup.

## Frontend integration (this session)

The React frontend (see `frontend.zip` from the same conversation) is
now wired to this API for real — no more mock data:
- `frontend/src/api/client.js` — shared fetch wrapper, JWT storage,
  401-triggers-logout handling.
- `frontend/src/api/resources.js` — one function per endpoint.
- Every screen (`LoginScreen`, `DoctorDashboard`, `ConsultRecorder`,
  `PatientSearch`, `PatientDetail`, `OrderPreview`, `FacilityPortal`)
  calls the real API instead of hardcoded arrays.
- `ConsultRecorder` uses the browser's real `MediaRecorder` API to
  capture audio and uploads the actual blob — this is the one screen
  where "wired to the backend" also means "does something genuinely new"
  rather than just swapping mock data for a fetch call.

This was validated with `esbuild` (JSX syntax check on all files) and a
full curl-based walkthrough of the exact endpoints each screen calls,
including the two new routes above. It has **not** been run in an
actual browser/Vite dev server in this session — that's the natural
next check.
