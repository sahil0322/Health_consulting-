import React, { useEffect, useState } from "react";
import {
  Stethoscope,
  ChevronRight,
  Phone,
  MapPin,
  Cake,
  Droplet,
  AlertTriangle,
  Pill,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
} from "lucide-react";
import { patientsApi, consultationsApi } from "./api/resources";

/*
  PatientDetail
  --------------
  Full patient record. Demographics + allergy/condition/medication
  panels come from GET /api/patients/{id}. Visit history comes from
  GET /api/patients/{id}/consultations; expanding a visit lazily fetches
  its full detail (transcript + claims) via GET /api/consultations/{id}.

  Note: there's no vitals-tracking model in the backend yet (no BP/HR/
  temp/SpO2 table), so the "vitals trend" tab from the original mock is
  dropped here rather than faked — add a Vitals model + endpoint before
  reintroducing it.
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
  amber: "#B4740E",
  amberSoft: "#FBF0DE",
  amberBorder: "#EAD3A0",
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

function age(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

const STATUS_LABEL = {
  recording: "Recording",
  processing: "Processing",
  transcribing: "Transcribing",
  ready_for_review: "In review",
  approved: "Approved",
  dispatched: "Completed",
};

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0" }}>
      <Icon size={14} color={theme.inkFaint} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: theme.inkFaint, width: 76, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: theme.ink }}>{value}</span>
    </div>
  );
}

function Tag({ children, tone = "neutral" }) {
  const tones = {
    neutral: { color: theme.inkMuted, bg: "#EFEEE8", border: theme.line },
    warning: { color: theme.brick, bg: theme.brickSoft, border: theme.brickBorder },
    accent: { color: theme.accent, bg: theme.accentSoft, border: theme.accentBorder },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 500,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: "3px 9px",
        display: "inline-block",
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

function VisitCard({ visit, expanded, onToggle }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isReview = visit.status === "ready_for_review";

  function handleToggle() {
    onToggle();
    if (!expanded && !detail && !loading) {
      setLoading(true);
      consultationsApi
        .get(visit.id)
        .then(setDetail)
        .catch((err) => setError(err.message || "Couldn't load this visit."))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.line}`,
        borderRadius: 12,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: isReview ? theme.amberSoft : theme.accentSoft,
              border: `1px solid ${isReview ? theme.amberBorder : theme.accentBorder}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 600, color: isReview ? theme.amber : theme.accent, lineHeight: 1 }}>
              {new Date(visit.started_at).toLocaleDateString([], { month: "short" }).toUpperCase()}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: isReview ? theme.amber : theme.accent, lineHeight: 1.3 }}>
              {new Date(visit.started_at).getDate()}
            </span>
          </div>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500, color: theme.ink }}>
              {visit.chief_complaint || "No chief complaint recorded"}
            </div>
            <div style={{ fontSize: 12, color: theme.inkFaint, marginTop: 1 }}>
              {new Date(visit.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Tag tone={isReview ? "warning" : "neutral"}>{STATUS_LABEL[visit.status] || visit.status}</Tag>
          {expanded ? <ChevronUp size={15} color={theme.inkFaint} /> : <ChevronDown size={15} color={theme.inkFaint} />}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${theme.line}` }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0", color: theme.inkFaint, fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
              Loading visit details&hellip;
            </div>
          )}
          {error && <p style={{ fontSize: 12.5, color: theme.brick, marginTop: 12 }}>{error}</p>}
          {detail && (
            <div style={{ marginTop: 12 }}>
              {detail.claims.length === 0 ? (
                <p style={{ fontSize: 12.5, color: theme.inkFaint }}>No AI-drafted findings recorded for this visit.</p>
              ) : (
                detail.claims.map((claim) => (
                  <div key={claim.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <Pill size={12} color={theme.accent} style={{ marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: theme.ink, margin: 0 }}>
                        {claim.decision === "edited" && claim.edited_text ? claim.edited_text : claim.text}
                      </p>
                      <span style={{ fontSize: 10.5, color: theme.inkFaint, textTransform: "capitalize" }}>
                        {claim.category} \u00b7 {claim.decision}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientDetail({ patientId }) {
  useGoogleFonts();
  const [patient, setPatient] = useState(null);
  const [patientError, setPatientError] = useState(null);
  const [visits, setVisits] = useState([]);
  const [visitsError, setVisitsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setPatientError(null);
    setVisitsError(null);
    Promise.allSettled([patientsApi.get(patientId), patientsApi.consultationHistory(patientId)]).then(
      ([patientResult, visitsResult]) => {
        if (patientResult.status === "fulfilled") setPatient(patientResult.value);
        else setPatientError(patientResult.reason?.message || "Couldn't load patient record.");

        if (visitsResult.status === "fulfilled") {
          setVisits(visitsResult.value);
          if (visitsResult.value.length > 0) setExpandedId(visitsResult.value[0].id);
        } else {
          setVisitsError(visitsResult.reason?.message || "Couldn't load visit history.");
        }
        setLoading(false);
      }
    );
  }, [patientId]);

  if (!patientId) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", padding: 40, color: theme.inkFaint }}>
        No patient selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: theme.inkFaint }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", padding: 40 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: theme.brick, fontSize: 13.5 }}>
          <AlertTriangle size={15} style={{ marginTop: 2, flexShrink: 0 }} />
          {patientError || "Patient not found."}
        </div>
      </div>
    );
  }

  const initials = patient.full_name.split(" ").map((n) => n[0]).join("");

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: theme.ink, background: theme.paper, minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: `1px solid ${theme.line}`,
          background: theme.surface,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: theme.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Stethoscope size={15} color="#FFFFFF" strokeWidth={2.25} />
          </div>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500 }}>Consult</span>
          <ChevronRight size={13} color={theme.inkFaint} />
          <span style={{ fontSize: 13, color: theme.inkMuted }}>Patients</span>
          <ChevronRight size={13} color={theme.inkFaint} />
          <span style={{ fontSize: 13, color: theme.ink }}>{patient.full_name}</span>
        </div>
        <button
          onClick={() => {
            consultationsApi
              .start(patientId, "")
              .then((c) => {
                window.location.hash = `record/${c.id}`;
              })
              .catch(() => {});
          }}
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
          Start new consultation
        </button>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px 60px", display: "flex", gap: 22 }}>
        <div style={{ width: 260, flexShrink: 0 }}>
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.line}`,
              borderRadius: 12,
              padding: "20px 18px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: theme.accentSoft,
                  border: `1px solid ${theme.accentBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 600,
                  color: theme.accent,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500, color: theme.ink }}>
                  {patient.full_name}
                </div>
                <div style={{ fontSize: 12.5, color: theme.inkMuted }}>
                  {age(patient.date_of_birth)} yrs &middot; {patient.sex}
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${theme.line}`, paddingTop: 4 }}>
              <InfoRow icon={Cake} label="DOB" value={new Date(patient.date_of_birth).toLocaleDateString()} />
              <InfoRow icon={Phone} label="Phone" value={patient.phone || "\u2014"} />
              <InfoRow icon={MapPin} label="Location" value={patient.address || "\u2014"} />
              <InfoRow icon={Droplet} label="Blood grp" value={patient.blood_group || "\u2014"} />
            </div>
          </div>

          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.line}`,
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <AlertTriangle size={13} color={theme.brick} />
              <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: theme.inkMuted }}>
                Allergies
              </span>
            </div>
            <div>
              {patient.allergies.length === 0 ? (
                <span style={{ fontSize: 12.5, color: theme.inkFaint }}>None recorded</span>
              ) : (
                patient.allergies.map((a) => (
                  <Tag key={a} tone="warning">
                    {a}
                  </Tag>
                ))
              )}
            </div>
          </div>

          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.line}`,
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: theme.inkMuted, marginBottom: 10 }}>
              Chronic conditions
            </div>
            <div>
              {patient.chronic_conditions.length === 0 ? (
                <span style={{ fontSize: 12.5, color: theme.inkFaint }}>None recorded</span>
              ) : (
                patient.chronic_conditions.map((c) => <Tag key={c}>{c}</Tag>)
              )}
            </div>
          </div>

          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.line}`,
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Pill size={13} color={theme.accent} />
              <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: theme.inkMuted }}>
                Current medications
              </span>
            </div>
            {patient.current_medications.length === 0 ? (
              <span style={{ fontSize: 12.5, color: theme.inkFaint }}>None recorded</span>
            ) : (
              patient.current_medications.map((m) => (
                <div key={m} style={{ fontSize: 12.5, color: theme.ink, marginBottom: 3 }}>
                  &bull; {m}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <Calendar size={14} color={theme.accent} />
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.ink }}>Visit history</span>
          </div>

          {visitsError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: theme.brick, fontSize: 13, marginBottom: 16 }}>
              <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              {visitsError}
            </div>
          )}

          {!visitsError && visits.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.inkFaint, fontSize: 13.5, padding: "20px 0" }}>
              <FileText size={16} />
              No consultations recorded yet.
            </div>
          )}

          {visits.map((v) => (
            <VisitCard key={v.id} visit={v} expanded={expandedId === v.id} onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
