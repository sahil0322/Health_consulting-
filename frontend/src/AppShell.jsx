import React, { useEffect, useState } from "react";
import {
  Stethoscope,
  LayoutGrid,
  Users,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";

import DoctorDashboard from "./DoctorDashboard";
import ConsultRecorder from "./ConsultRecorder";
import PatientDetail from "./PatientDetail";
import LoginScreen from "./LoginScreen";
import PatientSearch from "./PatientSearch";
import OrderPreview from "./OrderPreview";
import { authApi } from "./api/resources";
import { getToken, clearToken, onSessionExpired } from "./api/client";

/*
  AppShell — routing
  --------------------
  Ties DoctorDashboard, ConsultRecorder, and PatientDetail into one app with
  a persistent left rail and a tiny hash-based router. No react-router
  dependency, on purpose — this environment doesn't guarantee it's
  available. Swap `useHashRoute` for react-router-dom in the real project;
  the route shape (`#/queue`, `#/patient/:id`, `#/record/:id`) is designed
  to map onto real routes 1:1 with minimal changes.

  Cross-screen navigation notes (currently stubbed with console.log —
  wire these up as the three page components grow real props):
  - DoctorDashboard patient row click -> could deep-link to PatientDetail
  - PatientDetail "Start new consultation" -> navigate("/record/:id")
  - ConsultRecorder "Review AI summary" -> navigate("/queue") scrolled to
    that patient's review pane
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

/** Minimal hash router: reads/writes window.location.hash, no dependency. */
function useHashRoute() {
  const parse = () => {
    const raw = window.location.hash.replace(/^#\/?/, "") || "queue";
    const [name, param] = raw.split("/");
    return { name, param };
  };
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
  };

  return [route, navigate];
}

const NAV_ITEMS = [
  { key: "queue", label: "Queue", icon: LayoutGrid },
  { key: "patient", label: "Patients", icon: Users },
];

function NavRail({ activeKey, onNavigate, onSignOut }) {
  return (
    <div
      style={{
        width: 64,
        flexShrink: 0,
        background: theme.surface,
        borderRight: `1px solid ${theme.line}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 0",
        height: "100vh",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: theme.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 22,
          flexShrink: 0,
        }}
      >
        <Stethoscope size={17} color="#FFFFFF" strokeWidth={2.25} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key === "patient" ? "search" : "queue")}
              title={item.label}
              style={{
                width: 40,
                height: 40,
                borderRadius: 9,
                border: "none",
                background: active ? theme.accentSoft : "transparent",
                color: active ? theme.accent : theme.inkFaint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Icon size={17} strokeWidth={2.25} />
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <button
          title="Notifications"
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            border: "none",
            background: "transparent",
            color: theme.inkFaint,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Bell size={17} strokeWidth={2.25} />
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 9,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: theme.brick,
            }}
          />
        </button>
        <button
          title="Settings"
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            border: "none",
            background: "transparent",
            color: theme.inkFaint,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Settings size={17} strokeWidth={2.25} />
        </button>
        <div style={{ width: 28, height: 1, background: theme.line, margin: "4px 0" }} />
        <div
          title="Dr. R. Sharma"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: theme.accentSoft,
            border: `1px solid ${theme.accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color: theme.accent,
          }}
        >
          RS
        </div>
        <button
          title="Sign out"
          onClick={onSignOut}
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            border: "none",
            background: "transparent",
            color: theme.inkFaint,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <LogOut size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

export default function AppShell() {
  useGoogleFonts();
  const [route, navigate] = useHashRoute();
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // On first load, if a token is already stored (page refresh, return
  // visit), try to restore the session instead of forcing a re-login.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  // Any API call that gets a 401 fires this — drop back to the login
  // screen rather than leaving the user stuck on a broken page.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  function handleSignOut() {
    clearToken();
    setUser(null);
    navigate("queue");
  }

  if (checkingSession) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: theme.paper }} />
    );
  }

  if (!user) {
    return <LoginScreen onAuthenticated={setUser} />;
  }

  let screen;
  if (route.name === "record") {
    screen = <ConsultRecorder consultationId={route.param} />;
  } else if (route.name === "patient") {
    screen = <PatientDetail patientId={route.param} />;
  } else if (route.name === "search") {
    screen = <PatientSearch onSelect={(id) => navigate(`patient/${id}`)} />;
  } else if (route.name === "order") {
    screen = <OrderPreview consultationId={route.param} />;
  } else {
    screen = <DoctorDashboard />;
  }

  const activeNavKey =
    route.name === "record" || route.name === "order"
      ? "queue"
      : route.name === "patient" || route.name === "search"
      ? "patient"
      : route.name;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <NavRail activeKey={activeNavKey} onNavigate={navigate} onSignOut={handleSignOut} />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{screen}</div>
    </div>
  );
}
