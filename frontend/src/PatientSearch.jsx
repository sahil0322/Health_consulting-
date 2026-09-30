import React, { useEffect, useState } from "react";
import { Search, Plus, ChevronRight, Users, X, Loader2, AlertTriangle } from "lucide-react";
import { patientsApi } from "./api/resources";

/*
  PatientSearch
  --------------
  Directory of all patients (not just today's queue). Debounces the
  query and calls GET /api/patients?q= for real. Row click navigates to
  PatientDetail for that patient's id via onSelect (wired by AppShell).
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

function initials(name) {
  return name.split(" ").map((n) => n[0]).join("");
}

function age(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function PatientSearch({ onSelect = () => {} }) {
  useGoogleFonts();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce the search so we're not firing a request per keystroke.
  useEffect(() => {
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      patientsApi
        .search(query.trim())
        .then(setResults)
        .catch((err) => setError(err.message || "Couldn't load patients."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: theme.ink, background: theme.paper, minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, margin: 0 }}>Patients</h1>
            <p style={{ fontSize: 12.5, color: theme.inkFaint, margin: "3px 0 0" }}>
              {loading ? "Loading\u2026" : `${results.length} patient${results.length !== 1 ? "s" : ""} found`}
            </p>
          </div>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              fontWeight: 500,
              color: "#FFFFFF",
              background: theme.accent,
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            <Plus size={14} strokeWidth={2.25} />
            Add patient
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: theme.surface,
            border: `1px solid ${theme.line}`,
            borderRadius: 10,
            padding: "10px 13px",
            marginBottom: 18,
          }}
        >
          <Search size={15} color={theme.inkFaint} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone"
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
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}
            >
              <X size={14} color={theme.inkFaint} />
            </button>
          )}
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: theme.brick, fontSize: 13, marginBottom: 16 }}>
            <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "40px 0", color: theme.inkFaint, justifyContent: "center" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          </div>
        ) : results.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "50px 0",
              color: theme.inkFaint,
            }}
          >
            <Users size={26} strokeWidth={1.75} />
            <span style={{ fontSize: 13.5 }}>{query ? `No patients match "${query}"` : "No patients on record yet."}</span>
          </div>
        ) : (
          <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 12, overflow: "hidden" }}>
            {results.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: i < results.length - 1 ? `1px solid ${theme.line}` : "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: theme.accentSoft,
                    border: `1px solid ${theme.accentBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: theme.accent,
                    flexShrink: 0,
                  }}
                >
                  {initials(p.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14.5, fontWeight: 500, color: theme.ink }}>
                    {p.full_name}
                  </div>
                  <div style={{ fontSize: 12, color: theme.inkFaint, marginTop: 1 }}>
                    {age(p.date_of_birth)} yrs &middot; {p.sex} &middot; {p.phone || "No phone on file"}
                  </div>
                </div>
                <ChevronRight size={15} color={theme.inkFaint} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
