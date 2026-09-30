/*
  api/resources.js
  ------------------
  One function per backend endpoint, grouped by resource. Screens import
  from here rather than calling `api.get(...)` directly, so the URL
  strings live in exactly one place.
*/
import { api } from "./client";

export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }, { auth: false }),
  me: () => api.get("/auth/me"),
};

export const patientsApi = {
  search: (q) => api.get(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  get: (id) => api.get(`/patients/${id}`),
  update: (id, payload) => api.patch(`/patients/${id}`, payload),
  create: (payload) => api.post("/patients", payload),
  consultationHistory: (id) => api.get(`/patients/${id}/consultations`),
};

export const consultationsApi = {
  queue: () => api.get("/consultations"),
  get: (id) => api.get(`/consultations/${id}`),
  start: (patientId, chiefComplaint) =>
    api.post("/consultations", { patient_id: patientId, chief_complaint: chiefComplaint }),
  uploadAudio: (id, audioBlob, filename = "recording.webm") => {
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    return api.upload(`/consultations/${id}/audio`, formData);
  },
  decideClaim: (consultationId, claimId, decision, editedText) =>
    api.patch(`/consultations/${consultationId}/claims/${claimId}`, {
      decision,
      edited_text: editedText ?? null,
    }),
  approve: (id) => api.post(`/consultations/${id}/approve`),
};

export const facilitiesApi = {
  list: (kind) => api.get(`/facilities${kind ? `?kind=${kind}` : ""}`),
};

export const ordersApi = {
  dispatch: (consultationId, pharmacyId, labId) =>
    api.post(`/orders/consultations/${consultationId}/dispatch`, {
      pharmacy_id: pharmacyId ?? null,
      lab_id: labId ?? null,
    }),
  facilityQueue: () => api.get("/orders/facility/queue"),
  fulfillPrescription: (id) => api.post(`/orders/prescriptions/${id}/fulfill`),
  submitResult: (orderId, resultText, resultFileUrl) =>
    api.post(`/orders/diagnostic-orders/${orderId}/result`, {
      result_text: resultText ?? null,
      result_file_url: resultFileUrl ?? null,
    }),
};
