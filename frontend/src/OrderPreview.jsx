import React, { useEffect, useState } from "react";
import { Pill, FlaskConical, Send, Building2, Landmark, CheckCircle2, ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { consultationsApi, facilitiesApi, ordersApi } from "./api/resources";

/*
  OrderPreview
  -------------
  Human-readable preview of what's about to be dispatched, built from
  the approved consultation's "prescription" and "investigation"
  category claims (GET /api/consultations/{id}). Facility dropdowns are
  populated from GET /api/facilities?kind=pharmacy|lab. Confirming calls
  POST /api/orders/consultations/{id}/dispatch, which the backend turns
  into Prescription/DiagnosticOrder rows and (once fhir_dispatch.py is
  implemented for real) sends them on to the chosen facilities.
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

function OrderRow({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: `1px solid ${theme.line}` }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={theme.accent} strokeWidth={2.25} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: theme.ink }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: theme.inkMuted, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function FacilitySelect({ icon: Icon, label, options, value, onChange, loading }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={12} color={theme.inkMuted} />
        <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: theme.inkMuted }}>{label}</span>
      </div>
      {loading ? (
        <div style={{ fontSize: 12.5, color: theme.inkFaint, padding: "9px 0" }}>Loading facilities&hellip;</div>
      ) : options.length === 0 ? (
        <div style={{ fontSize: 12.5, color: theme.inkFaint, padding: "9px 0" }}>No facilities on record.</div>
      ) : (
        <div style={{ position: "relative" }}>
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%", appearance: "none", fontSize: 13, color: theme.ink, background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 9, padding: "9px 32px 9px 11px", fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer" }}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} color={theme.inkFaint} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        </div>
      )}
    </div>
  );
}

export default function OrderPreview({ consultationId }) {
  useGoogleFonts();
  const [detail, setDetail] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [labs, setLabs] = useState([]);
  const [pharmacyId, setPharmacyId] = useState(null);
  const [labId, setLabId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatched, setDispatched] = useState(false);

  useEffect(() => {
    if (!consultationId) {
      setLoading(false);
      return;
    }
    Promise.all([consultationsApi.get(consultationId), facilitiesApi.list("pharmacy"), facilitiesApi.list("lab")])
      .then(([consultation, pharmacyList, labList]) => {
        setDetail(consultation);
        setPharmacies(pharmacyList);
        setLabs(labList);
        if (pharmacyList.length > 0) setPharmacyId(pharmacyList[0].id);
        if (labList.length > 0) setLabId(labList[0].id);
        if (consultation.status === "dispatched") setDispatched(true);
      })
      .catch((err) => setLoadError(err.message || "Couldn't load this order."))
      .finally(() => setLoading(false));
  }, [consultationId]);

  function handleDispatch() {
    setDispatching(true);
    setDispatchError(null);
    ordersApi
      .dispatch(consultationId, pharmacyId, labId)
      .then(() => setDispatched(true))
      .catch((err) => setDispatchError(err.message || "Couldn't dispatch this order."))
      .finally(() => setDispatching(false));
  }

  if (!consultationId) {
    return <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", padding: 40, color: theme.inkFaint }}>No consultation selected.</div>;
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: theme.inkFaint }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", padding: 40, display: "flex", alignItems: "flex-start", gap: 8, color: theme.brick, fontSize: 13.5 }}>
        <AlertTriangle size={15} style={{ marginTop: 2, flexShrink: 0 }} />
        {loadError || "Order not found."}
      </div>
    );
  }

  const prescriptionClaims = detail.claims.filter((c) => c.category === "prescription" && c.decision !== "rejected");
  const investigationClaims = detail.claims.filter((c) => c.category === "investigation" && c.decision !== "rejected");

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: theme.ink, background: theme.paper, minHeight: "100vh" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, margin: 0 }}>Review order before dispatch</h1>
          <p style={{ fontSize: 13, color: theme.inkMuted, margin: "4px 0 0" }}>{detail.patient_name}</p>
        </div>

        {dispatched ? (
          <div style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}`, borderRadius: 12, padding: "28px 22px", textAlign: "center" }}>
            <CheckCircle2 size={26} color={theme.accent} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16.5, fontWeight: 500, color: theme.ink }}>Order dispatched</div>
            <p style={{ fontSize: 13, color: theme.inkMuted, margin: "6px 0 0", lineHeight: 1.55 }}>
              Prescriptions and investigation orders have been recorded and sent to the selected facilities.
            </p>
          </div>
        ) : (
          <>
            {dispatchError && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: theme.brickSoft, border: `1px solid ${theme.brickBorder}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
                <AlertTriangle size={15} color={theme.brick} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: theme.brick, lineHeight: 1.5 }}>{dispatchError}</span>
              </div>
            )}

            <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <Pill size={14} color={theme.accent} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.ink }}>Prescription</span>
              </div>
              {prescriptionClaims.length === 0 ? (
                <p style={{ fontSize: 12.5, color: theme.inkFaint, padding: "8px 0" }}>No approved prescription items.</p>
              ) : (
                prescriptionClaims.map((c) => (
                  <OrderRow key={c.id} icon={Pill} title={c.decision === "edited" && c.edited_text ? c.edited_text : c.text} />
                ))
              )}
              <FacilitySelect icon={Building2} label="Dispatch to pharmacy" options={pharmacies} value={pharmacyId} onChange={setPharmacyId} />
            </div>

            <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <FlaskConical size={14} color={theme.accent} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.ink }}>Diagnostic orders</span>
              </div>
              {investigationClaims.length === 0 ? (
                <p style={{ fontSize: 12.5, color: theme.inkFaint, padding: "8px 0" }}>No approved investigation items.</p>
              ) : (
                investigationClaims.map((c) => (
                  <OrderRow key={c.id} icon={FlaskConical} title={c.decision === "edited" && c.edited_text ? c.edited_text : c.text} />
                ))
              )}
              <FacilitySelect icon={Landmark} label="Send to laboratory" options={labs} value={labId} onChange={setLabId} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleDispatch}
                disabled={dispatching || (prescriptionClaims.length === 0 && investigationClaims.length === 0)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "#FFFFFF",
                  background: theme.accent,
                  border: "none",
                  borderRadius: 9,
                  padding: "10px 18px",
                  cursor: dispatching ? "default" : "pointer",
                  opacity: dispatching || (prescriptionClaims.length === 0 && investigationClaims.length === 0) ? 0.6 : 1,
                }}
              >
                <Send size={14} strokeWidth={2.25} />
                {dispatching ? "Dispatching\u2026" : "Confirm and dispatch"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
