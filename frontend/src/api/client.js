/*
  api/client.js
  --------------
  Thin fetch wrapper shared by every screen. Handles:
    - base URL (override with VITE_API_BASE_URL in your .env)
    - attaching the bearer token from storage
    - JSON encode/decode
    - a consistent error shape so screens can show a real message
      instead of "Failed to fetch"
    - redirecting to logged-out state on a 401 (session expired)

  Token storage uses localStorage — this is real app code (not a
  sandboxed artifact), so that's the normal, correct choice. Swap for an
  httpOnly cookie set by the backend if you want the token inaccessible
  to JS entirely (more XSS-resistant, but requires backend changes to
  set/clear the cookie on login/logout).
*/

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:8000/api";

const TOKEN_KEY = "consult_access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Fired whenever a request gets a 401 — AppShell listens for this to drop
 * back to the login screen rather than every caller checking manually.
 */
const SESSION_EXPIRED_EVENT = "consult:session-expired";

export function onSessionExpired(handler) {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

/**
 * Core request function. `path` is relative to API_BASE_URL, e.g. "/patients".
 * Pass `body` as a plain object for JSON requests, or a FormData instance
 * for file uploads (Content-Type is omitted so the browser sets the
 * multipart boundary itself).
 */
async function request(path, { method = "GET", body, auth = true, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0, null);
  }

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError("Your session has expired. Please sign in again.", 401, null);
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status, data);
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  upload: (path, formData, opts) => request(path, { ...opts, method: "POST", body: formData, isFormData: true }),
};
