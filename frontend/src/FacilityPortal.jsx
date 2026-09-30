import React, { useEffect, useState } from "react";
import { FlaskConical, Pill, Clock, CheckCircle2, Upload, Building2, ChevronRight, X, Loader2, AlertTriangle } from "lucide-react";
import { ordersApi } from "./api/resources";

/*
  FacilityPortal
  ---------------
  The other end of the workflow: a lab/pharmacy staff view of incoming
  orders, wired to GET /api/orders/facility/queue,
  POST /api/orders/prescriptions/{id}/fulfill, and
  POST /api/orders/diagnostic-orders/{id}/result.

  This assumes a facility_staff session token is already in localStorage
  (see api/client.js) — this pass wires the data, but a dedicated
  login/app-shell for facility staff (separate from the doctor-facing
  AppShell/LoginScreen) isn't built yet. Use the seeded lab account
  (lab@pathlab.dev) via LoginScreen for now to get a valid token, since
  the login endpoint doesn't distinguish roles at sign-in time.
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

function TypeBadge({ kind }) {
  const isLab = kind === "lab";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: theme.accent, background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 999, padding: "2px 8px" }}>
      {isLab ? <FlaskConical size={11} /> : <Pill size={11} />}
      {isLab ? "Lab" : "Pharmacy"}
    </span>
  );
}

function OrderCard({ order, onFulfil, onSubmitResult }) {
  const [showUpload, setShowUpload] = useState(false);
  const [resultText, setResultText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = order.status === "pending";

  function handleSubmit() {
    setSubmitting(true);
    onSubmitResult(order.id, resultText).finally(() => {
      setSubmitting(false);
      setShowUpload(false);
    });
  }

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <TypeBadge kind={order.kind} />
            {pending ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: theme.amber }}>
                <Clock size={11} />
                Pending
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: theme.inkFaint }}>
                <CheckCircle2 size={11} />
                Fulfilled
              </span>
            )}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14.5, fontWeight: 500, color: theme.ink }}>{order.patient_name}</div>
          <div style={{ fontSize: 12.5, color: theme.inkMuted, marginTop: 2 }}>{order.item_description}</div>
          <div style={{ fontSize: 11, color: theme.inkFaint, marginTop: 6 }}>
            Ordered by {order.ordered_by} &middot; {new Date(order.created_at).toLocaleString()}
          </div>
        </div>

        {pending && (
          <button
            onClick={() => (order.kind === "lab" ? setShowUpload(true) : onFulfil(order.id))}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "#FFFFFF", background: theme.accent, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {order.kind === "lab" ? (
              <>
                <Upload size={12.5} strokeWidth={2.25} />
                Attach result
              </>
            ) : (
              <>
                <CheckCircle2 size={12.5} strokeWidth={2.25} />
                Mark fulfilled
              </>
            )}
          </button>
        )}
      </div>

      {showUpload && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <input
            value={resultText}
            onChange={(e) => setResultText(e.target.value)}
            placeholder="Enter result summary"
            style={{ flex: 1, fontSize: 12.5, color: theme.ink, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "9px 12px", fontFamily: "'IBM Plex Sans', sans-serif" }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !resultText.trim()}
            style={{ fontSize: 12.5, fontWeight: 500, color: "#FFFFFF", background: theme.accent, border: "none", borderRadius: 7, padding: "9px 12px", cursor: "pointer", whiteSpace: "nowrap", opacity: submitting || !resultText.trim() ? 0.6 : 1 }}
          >
            {submitting ? "Submitting\u2026" : "Submit"}
          </button>
          <button onClick={() => setShowUpload(false)} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", color: theme.inkFaint }}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function FacilityPortal() {
  useGoogleFonts();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");

  function loadQueue() {
    setLoading(true);
    setError(null);
    ordersApi
      .facilityQueue()
      .then(setOrders)
      .catch((err) => setError(err.message || "Couldn't load the order queue."))
      .finally(() => setLoading(false));
  }

  useEffect(loadQueue, []);

  function handleFulfil(id) {
    return ordersApi.fulfillPrescription(id).then(() => loadQueue());
  }

  function handleSubmitResult(id, text) {
    return ordersApi.submitResult(id, text).then(() => loadQueue());
  }

  const visible = orders.filter((o) => (filter === "all" ? true : o.status === filter));
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: theme.ink, background: theme.paper, minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${theme.line}`, background: theme.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={15} color="#FFFFFF" strokeWidth={2.25} />
          </div>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500 }}>Facility portal</span>
          <ChevronRight size={13} color={theme.inkFaint} />
          <span style={{ fontSize: 13, color: theme.inkMuted }}>Order queue</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0 }}>Incoming orders</h1>
            <p style={{ fontSize: 12.5, color: theme.inkFaint, margin: "3px 0 0" }}>
              {loading ? "Loading\u2026" : `${pendingCount} pending`}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: theme.brick, fontSize: 13, marginBottom: 16 }}>
            <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {["pending", "fulfilled", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ fontSize: 12.5, fontWeight: 500, color: filter === f ? theme.accent : theme.inkFaint, background: filter === f ? theme.accentSoft : "transparent", border: `1px solid ${filter === f ? theme.accentBorder : theme.line}`, borderRadius: 999, padding: "5px 12px", cursor: "pointer", textTransform: "capitalize" }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "50px 0", color: theme.inkFaint }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: theme.inkFaint, fontSize: 13.5 }}>
            No {filter !== "all" ? filter : ""} orders right now.
          </div>
        ) : (
          visible.map((o) => <OrderCard key={o.id} order={o} onFulfil={handleFulfil} onSubmitResult={handleSubmitResult} />)
        )}
      </div>
    </div>
  );
}
