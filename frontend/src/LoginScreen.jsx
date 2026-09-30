import React, { useEffect, useState } from "react";
import { Stethoscope, Mail, Lock, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { authApi } from "./api/resources";
import { setToken } from "./api/client";

/*
  LoginScreen
  ------------
  Email/password gate in front of AppShell. Calls the real
  POST /api/auth/login endpoint, stores the returned JWT, then fetches
  /api/auth/me to get the full user object before calling
  onAuthenticated(user).

  No OTP/MFA UI yet, though the PID's privacy section (7.1) implies MFA
  will be required for production — flagged as a follow-up, not built here.
*/

const theme = {
  paper: "#FAFAF8",
  surface: "#FFFFFF",
  ink: "#1C2321",
  inkMuted: "#5B6462",
  inkFaint: "#8B928F",
  line: "#E4E1D8",
  accent: "#2F6F62",
  accentSoft: "#E4EFEC",
  accentBorder: "#BFDBD2",
  brick: "#A83A34",
  brickSoft: "#F7E7E5",
  brickBorder: "#E8BEBA",
};

function useGoogleFonts() {
  useEffect(() => {
    const id = "dd-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

export default function LoginScreen({ onAuthenticated = () => {} }) {
  useGoogleFonts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Enter both your email and password.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setLoading(true);
    authApi
      .login(email, password)
      .then(({ access_token }) => {
        setToken(access_token);
        return authApi.me();
      })
      .then((user) => {
        onAuthenticated(user);
      })
      .catch((err) => {
        setError(err.message || "Couldn't sign in. Check your credentials and try again.");
      })
      .finally(() => setLoading(false));
  }

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: theme.paper,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: theme.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Stethoscope size={22} color="#FFFFFF" strokeWidth={2.25} />
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, color: theme.ink, margin: 0 }}>
            Consult
          </h1>
          <p style={{ fontSize: 12.5, color: theme.inkFaint, margin: "4px 0 0" }}>
            Sign in to your clinician account
          </p>
        </div>

        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.line}`,
            borderRadius: 14,
            padding: 24,
          }}
        >
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                background: theme.brickSoft,
                border: `1px solid ${theme.brickBorder}`,
                borderRadius: 9,
                padding: "9px 11px",
                marginBottom: 16,
              }}
            >
              <AlertTriangle size={14} color={theme.brick} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: theme.brick, lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.inkMuted, marginBottom: 6 }}>
              Email
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${theme.line}`,
                borderRadius: 9,
                padding: "9px 11px",
                marginBottom: 14,
              }}
            >
              <Mail size={14} color={theme.inkFaint} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13.5,
                  color: theme.ink,
                  width: "100%",
                  background: "transparent",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              />
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: theme.inkMuted, marginBottom: 6 }}>
              Password
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${theme.line}`,
                borderRadius: 9,
                padding: "9px 11px",
                marginBottom: 18,
              }}
            >
              <Lock size={14} color={theme.inkFaint} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13.5,
                  color: theme.ink,
                  width: "100%",
                  background: "transparent",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#FFFFFF",
                background: theme.accent,
                border: "none",
                borderRadius: 9,
                padding: "10px 0",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
                  Signing in&hellip;
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
              marginTop: 16,
              paddingTop: 14,
              borderTop: `1px solid ${theme.line}`,
            }}
          >
            <ShieldCheck size={12} color={theme.inkFaint} />
            <span style={{ fontSize: 11, color: theme.inkFaint }}>
              Access is logged and restricted to verified clinicians
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
