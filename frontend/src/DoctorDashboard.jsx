import React, { useEffect, useMemo, useState } from "react";
import {
  Stethoscope,
  Clock,
  ChevronRight,
  Mic,
  FileText,
  CheckCircle2,
  XCircle,
  Pencil,
  FlaskConical,
  Pill,
  ClipboardList,
  AlertCircle,
  Link2,
  Send,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { consultationsApi } from "./api/resources";

/*
  Doctor Dashboard
  -----------------
  Three-pane clinical workspace: patient queue, AI draft review, transcript
  evidence. Wired to the real backend:
    - queue          <- GET /api/consultations
    - detail pane     <- GET /api/consultations/{id}
    - accept/edit/reject <- PATCH /api/consultations/{id}/claims/{claimId}
    - approve         <- POST /api/consultations/{id}/approve, then routes
                         to the order preview screen for dispatch.
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

// Keys match the backend's ConsultationStatus enum values exactly.
const STATUS_META = {
  recording: { label: "Recording", icon: Mic, color: theme.brick, bg: theme.brickSoft, border: theme.brickBorder },
  processing: { label: "Processing", icon: Loader2, color: theme.amber, bg: theme.amberSoft, border: theme.amberBorder },
  transcribing: { label: "Transcribing", icon: FileText, color: theme.amber, bg: theme.amberSoft, border: theme.amberBorder },
  ready_for_review: { label: "Ready for review", icon: ClipboardList, color: theme.accent, bg: theme.accentSoft, border: theme.accentBorder },
  approved: { label: "Approved", icon: CheckCircle2, color: theme.inkMuted, bg: "#EFEEE8", border: theme.line },
  dispatched: { label: "Dispatched", icon: Send, color: theme.inkFaint, bg: "#EFEEE8", border: theme.line },
};

// Category -> display label/icon for grouping claims in the review pane.
const CATEGORY_META = {
  summary: { label: "Chief complaint & history", icon: ClipboardList },
  assessment: { label: "Assessment", icon: Stethoscope },
  investigation: { label: "Suggested investigations", icon: FlaskConical },
  prescription: { label: "Draft prescription", icon: Pill },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.recording;
  const Icon = meta.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 500,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 999,
        padding: "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

function PatientQueue({ queue, loading, error, selectedId, onSelect }) {
  return (
    <div
      style={{
        width: 272,
        flexShrink: 0,
        borderRight: `1px solid ${theme.line}`,
        background: theme.paper,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ padding: "18px 18px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: theme.inkFaint, textTransform: "uppercase" }}>
          Your queue
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            background: theme.surface,
            border: `1px solid ${theme.line}`,
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <Search size={14} color={theme.inkFaint} />
          <span style={{ fontSize: 13, color: theme.inkFaint, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Search patients
          </span>
        </div>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 12px" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 14px", color: theme.inkFaint, fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
            Loading queue&hellip;
          </div>
        )}
        {error && !loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "14px", color: theme.brick, fontSize: 12.5 }}>
            <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            {error}
          </div>
        )}
        {!loading && !error && queue.length === 0 && (
          <div style={{ padding: "20px 14px", color: theme.inkFaint, fontSize: 13 }}>No consultations yet.</div>
        )}
        {queue.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "block",
                background: active ? theme.surface : "transparent",
                border: `1px solid ${active ? theme.accentBorder : "transparent"}`,
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 4,
                cursor: "pointer",
                boxShadow: active ? "0 1px 2px rgba(28,35,33,0.04)" : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 14.5,
                    fontWeight: 500,
                    color: theme.ink,
                  }}
                >
                  {c.patient_name}
                </span>
                <span style={{ fontSize: 11.5, color: theme.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {new Date(c.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: theme.inkMuted, marginTop: 2, marginBottom: 8 }}>
                {c.chief_complaint || "No chief complaint recorded"}
              </div>
              <StatusBadge status={c.status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClaimCard({ claim, isActive, onSelect, onDecide }) {
  const decision = claim.decision;
  const flagged = claim.requires_verification;
  const displayText = decision === "edited" && claim.edited_text ? claim.edited_text : claim.text;

  return (
    <div
      onClick={() => onSelect(claim.id)}
      style={{
        border: `1.5px solid ${isActive ? theme.accent : theme.line}`,
        background: isActive ? theme.accentSoft : theme.surface,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 8,
        cursor: "pointer",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: theme.ink,
          margin: 0,
          textDecoration: decision === "rejected" ? "line-through" : "none",
          opacity: decision === "rejected" ? 0.55 : 1,
        }}
      >
        {displayText}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link2 size={12} color={theme.inkFaint} />
          <span style={{ fontSize: 11, color: theme.inkFaint, fontFamily: "'IBM Plex Mono', monospace" }}>
            {claim.source_line_ids.length} source{claim.source_line_ids.length !== 1 ? "s" : ""}
          </span>
          {flagged && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4, color: theme.amber, fontSize: 11, fontWeight: 500 }}>
              <AlertCircle size={12} />
              Verify
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <IconAction
            active={decision === "accepted"}
            activeColor={theme.accent}
            activeBg={theme.accentSoft}
            onClick={() => onDecide(claim, "accepted")}
            icon={CheckCircle2}
            label="Accept"
          />
          <IconAction
            active={decision === "edited"}
            activeColor={theme.amber}
            activeBg={theme.amberSoft}
            onClick={() => onDecide(claim, "edited")}
            icon={Pencil}
            label="Edit"
          />
          <IconAction
            active={decision === "rejected"}
            activeColor={theme.brick}
            activeBg={theme.brickSoft}
            onClick={() => onDecide(claim, "rejected")}
            icon={XCircle}
            label="Reject"
          />
        </div>
      </div>
    </div>
  );
}

function IconAction({ active, activeColor, activeBg, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        border: `1px solid ${active ? activeColor : theme.line}`,
        background: active ? activeBg : theme.surface,
        color: active ? activeColor : theme.inkFaint,
        cursor: "pointer",
      }}
    >
      <Icon size={13.5} strokeWidth={2.25} />
    </button>
  );
}

function ReviewPane({ detail, loading, error, activeClaimId, setActiveClaimId, onDecide, onApprove, approving, approveError }) {
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: theme.inkFaint }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: theme.brick, fontSize: 13.5, padding: 24, textAlign: "center" }}>
        {error}
      </div>
    );
  }
  if (!detail) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: theme.inkFaint, fontSize: 13.5 }}>
        Select a patient from the queue.
      </div>
    );
  }

  const groups = {};
  for (const claim of detail.claims) {
    if (!groups[claim.category]) groups[claim.category] = [];
    groups[claim.category].push(claim);
  }

  const totalCount = detail.claims.length;
  const decidedCount = detail.claims.filter((c) => c.decision !== "pending").length;
  const alreadyApproved = detail.status === "approved" || detail.status === "dispatched";

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${theme.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, color: theme.ink, margin: 0 }}>
            {detail.patient_name}
          </h1>
        </div>
        <p style={{ fontSize: 12.5, color: theme.inkFaint, marginTop: 6 }}>
          AI-drafted from consultation transcript. Review each item against its source before approving.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 8px" }}>
        {totalCount === 0 && (
          <p style={{ fontSize: 13, color: theme.inkFaint }}>
            No AI-drafted claims yet — this consultation may still be transcribing.
          </p>
        )}
        {Object.entries(groups).map(([categoryKey, claims]) => {
          const meta = CATEGORY_META[categoryKey] || { label: categoryKey, icon: ClipboardList };
          const Icon = meta.icon;
          return (
            <div key={categoryKey} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Icon size={14} color={theme.accent} strokeWidth={2.25} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.inkMuted }}>
                  {meta.label}
                </span>
              </div>
              {claims.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  isActive={activeClaimId === claim.id}
                  onSelect={setActiveClaimId}
                  onDecide={onDecide}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderTop: `1px solid ${theme.line}`,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: theme.surface,
        }}
      >
        <span style={{ fontSize: 12.5, color: approveError ? theme.brick : theme.inkMuted }}>
          {approveError || (alreadyApproved ? "Approved \u2014 continue to dispatch" : `${decidedCount} of ${totalCount} items reviewed`)}
        </span>
        <button
          disabled={(!alreadyApproved && (decidedCount < totalCount || totalCount === 0)) || approving}
          onClick={onApprove}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            fontWeight: 500,
            color: !alreadyApproved && (decidedCount < totalCount || totalCount === 0) ? theme.inkFaint : "#FFFFFF",
            background: !alreadyApproved && (decidedCount < totalCount || totalCount === 0) ? "#EFEEE8" : theme.accent,
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: (!alreadyApproved && (decidedCount < totalCount || totalCount === 0)) || approving ? "not-allowed" : "pointer",
            opacity: approving ? 0.75 : 1,
          }}
        >
          <Send size={14} strokeWidth={2.25} />
          {alreadyApproved ? "Go to order preview" : approving ? "Approving\u2026" : "Approve and dispatch"}
        </button>
      </div>
    </div>
  );
}

function TranscriptPane({ detail, activeClaimId }) {
  const activeSources = useMemo(() => {
    if (!detail || !activeClaimId) return new Set();
    const claim = detail.claims.find((c) => c.id === activeClaimId);
    return claim ? new Set(claim.source_line_ids) : new Set();
  }, [detail, activeClaimId]);

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: `1px solid ${theme.line}`,
        background: theme.paper,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ padding: "18px 18px 12px", borderBottom: `1px solid ${theme.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <FileText size={14} color={theme.inkMuted} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.inkMuted }}>
            Transcript
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: theme.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
          {activeClaimId ? "Highlighted lines ground the selected item." : "Select an item on the left to see its source."}
        </p>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "10px 14px" }}>
        {!detail || detail.transcript_lines.length === 0 ? (
          <p style={{ fontSize: 12.5, color: theme.inkFaint, padding: "0 4px" }}>No transcript available yet.</p>
        ) : (
          detail.transcript_lines.map((line) => {
            const isSource = activeSources.has(line.id);
            return (
              <div
                key={line.id}
                style={{
                  padding: "8px 10px",
                  marginBottom: 4,
                  borderRadius: 8,
                  background: isSource ? theme.accentSoft : "transparent",
                  border: `1px solid ${isSource ? theme.accentBorder : "transparent"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      color: theme.inkMuted,
                    }}
                  >
                    {/* Whisper (used for real transcription) has no
                        speaker diarization, so every line is generically
                        labeled "dictation" rather than a guessed
                        doctor/patient split — see ai_pipeline.py. */}
                    {line.speaker}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, lineHeight: 1.5, color: theme.ink, margin: 0 }}>{line.text}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function DoctorDashboard() {
  useGoogleFonts();
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [activeClaimId, setActiveClaimId] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);

  // Load today's queue on mount.
  useEffect(() => {
    consultationsApi
      .queue()
      .then((data) => {
        setQueue(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => setQueueError(err.message || "Couldn't load your queue."))
      .finally(() => setQueueLoading(false));
  }, []);

  // Load consultation detail whenever selection changes.
  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError(null);
    setActiveClaimId(null);
    setApproveError(null);
    consultationsApi
      .get(selectedId)
      .then(setDetail)
      .catch((err) => setDetailError(err.message || "Couldn't load this consultation."))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  function handleSelectPatient(id) {
    setSelectedId(id);
  }

  function handleDecide(claim, decision) {
    // Clicking the same decision again reverts it to pending.
    const nextDecision = claim.decision === decision ? "pending" : decision;

    let editedText;
    if (nextDecision === "edited") {
      editedText = window.prompt("Edit this item's text:", claim.edited_text || claim.text);
      if (editedText === null) return; // cancelled
    }

    consultationsApi
      .decideClaim(detail.id, claim.id, nextDecision, editedText)
      .then((updatedClaim) => {
        setDetail((prev) => ({
          ...prev,
          claims: prev.claims.map((c) => (c.id === updatedClaim.id ? updatedClaim : c)),
        }));
        setActiveClaimId(claim.id);
      })
      .catch((err) => setApproveError(err.message || "Couldn't save that decision."));
  }

  function handleApprove() {
    if (detail.status === "approved" || detail.status === "dispatched") {
      window.location.hash = `order/${detail.id}`;
      return;
    }
    setApproving(true);
    setApproveError(null);
    consultationsApi
      .approve(detail.id)
      .then(() => {
        setDetail((prev) => ({ ...prev, status: "approved" }));
        window.location.hash = `order/${detail.id}`;
      })
      .catch((err) => setApproveError(err.message || "Couldn't approve this consultation."))
      .finally(() => setApproving(false));
  }

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: theme.ink,
        background: theme.paper,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: `1px solid ${theme.line}`,
          background: theme.surface,
          flexShrink: 0,
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
          <span style={{ fontSize: 13, color: theme.inkMuted }}>Doctor dashboard</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <PatientQueue queue={queue} loading={queueLoading} error={queueError} selectedId={selectedId} onSelect={handleSelectPatient} />
        <ReviewPane
          detail={detail}
          loading={detailLoading}
          error={detailError}
          activeClaimId={activeClaimId}
          setActiveClaimId={setActiveClaimId}
          onDecide={handleDecide}
          onApprove={handleApprove}
          approving={approving}
          approveError={approveError}
        />
        <TranscriptPane detail={detail} activeClaimId={activeClaimId} />
      </div>
    </div>
  );
}
