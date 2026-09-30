# Consult — Frontend

React screens for the AI-Assisted Clinical Consultation & Healthcare
Workflow Management System.

## Screens

| File                  | Route            | Role           |
|------------------------|------------------|----------------|
| `LoginScreen.jsx`      | (gate)           | doctor / staff |
| `AppShell.jsx`         | —                | doctor         |
| `DoctorDashboard.jsx`  | `#/queue`        | doctor         |
| `ConsultRecorder.jsx`  | `#/record/:id`   | doctor         |
| `PatientSearch.jsx`    | `#/search`       | doctor         |
| `PatientDetail.jsx`    | `#/patient/:id`  | doctor         |
| `OrderPreview.jsx`     | `#/order/:id`    | doctor         |
| `FacilityPortal.jsx`   | (standalone)     | facility staff |

`AppShell.jsx` wires the first six together with a tiny hash-based
router (no `react-router-dom` dependency). `FacilityPortal.jsx` is not
yet mounted into `AppShell` — it's a different user role and, in a real
deployment, likely belongs on its own route/subdomain with its own
shell. For now it expects a facility-staff JWT already in
`localStorage` (see below).

## Setup

This is a set of source files, not a scaffolded project — drop them
into a Vite + React app:

```bash
npm create vite@latest consult-frontend -- --template react
cd consult-frontend
npm install lucide-react
# copy src/*.jsx and src/api/*.js from this bundle into your src/
```

Set the API base URL if your backend isn't at the default:

```
# .env
VITE_API_BASE_URL=http://localhost:8000/api
```

(`api/client.js` falls back to `http://localhost:8000/api` if this
isn't set.)

Render `<AppShell />` as your app root (e.g. in `main.jsx`).

## Auth

- Token is stored in `localStorage` under `consult_access_token`. This
  is real app code (not a sandboxed artifact), so `localStorage` is the
  normal, correct choice here — swap for an httpOnly cookie if you want
  the token inaccessible to JS entirely (needs backend changes to
  set/clear it).
- `api/client.js` fires a `consult:session-expired` window event on any
  401; `AppShell` listens for it and drops back to `LoginScreen`.
- To try `FacilityPortal.jsx` standalone, log in through `LoginScreen`
  with the seeded lab account (`lab@pathlab.dev` / `devpassword123` —
  see the backend's `app/seed.py`), then render `<FacilityPortal />`
  directly; the login endpoint doesn't currently branch UI by role.

## What's real vs. still a stub

- Every screen fetches from the real backend — no hardcoded arrays
  remain (see `api/resources.js` for the full endpoint list).
- `ConsultRecorder.jsx` captures real microphone audio via
  `MediaRecorder` and uploads the actual blob. The upload will succeed;
  the *transcription* will currently fail server-side, because the
  backend's `ai_pipeline.py` is still a stub (raises
  `NotImplementedError`) until a real speech-to-text/LLM integration is
  wired in. The screen shows this as a clear inline error rather than
  hanging.
- No dedicated signup/patient-creation UI yet — `patientsApi.create`
  exists but isn't hooked to a form.
- Not yet tested in an actual browser/Vite dev server — this was
  validated with `esbuild` (syntax only) and by exercising the backend
  with curl using the same request shapes the frontend sends. Running
  it for real in a browser is the natural next check.
