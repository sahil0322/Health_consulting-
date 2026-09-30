import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Stethoscope,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { consultationsApi } from "./api/resources";

/*
  ConsultRecorder
  ----------------
  Captures real consultation audio via the browser's MediaRecorder API
  and uploads it to POST /api/consultations/{id}/audio, which triggers
  transcription server-side.

  Known current limitation: app/services/ai_pipeline.py's
  transcribe_audio() still raises NotImplementedError (see backend
  README) — so the upload will succeed but the transcription step will
  fail server-side until a real speech-to-text provider is wired in.
  This screen surfaces that failure as a clear inline error rather than
  hanging or crashing, so the rest of the flow stays testable.
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

const STAGES = ["idle", "recording", "uploading", "transcribing", "ready", "failed"];

const STAGE_META = {
  idle: { label: "Not started", color: theme.inkFaint },
  recording: { label: "Recording", color: theme.brick },
  uploading: { label: "Uploading audio", color: theme.amber },
  transcribing: { label: "Transcribing", color: theme.amber },
  ready: { label: "Ready for review", color: theme.accent },
  failed: { label: "Failed", color: theme.brick },
};

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StageTracker({ stage }) {
  const visibleStages = ["recording", "uploading", "transcribing", "ready"];
  const activeIndex = visibleStages.indexOf(stage === "failed" ? "uploading" : stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {visibleStages.map((s, i) => {
        const done = activeIndex > i;
        const active = activeIndex === i;
        const color = done || active ? STAGE_META[s].color : theme.line;
        return (
          <React.Fragment key={s}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: done || active ? color : theme.line, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 500, color: done || active ? theme.ink : theme.inkFaint, whiteSpace: "nowrap" }}>
                {STAGE_META[s].label}
              </span>
            </div>
            {i < visibleStages.length - 1 && <div style={{ width: 20, height: 1, background: theme.line }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Waveform({ active, level }) {
  const bars = 28;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 56 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const base = 6 + Math.abs(Math.sin(i * 0.7)) * 20;
        const h = active ? Math.max(6, base * (0.5 + level)) : 6;
        return (
          <div
            key={i}
            style={{ width: 3, height: h, borderRadius: 2, background: active ? theme.brick : theme.line, transition: "height 90ms ease" }}
          />
        );
      })}
    </div>
  );
}

export default function ConsultRecorder({ consultationId }) {
  useGoogleFonts();
  const [stage, setStage] = useState("idle");
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0.3);
  const [error, setError] = useState(null);
  const [micDenied, setMicDenied] = useState(false);
  const [result, setResult] = useState(null); // consultation detail once ready

  const timerRef = useRef(null);
  const levelRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(levelRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startMic() {
    setError(null);
    setMicDenied(false);

    if (!consultationId) {
      setError("No consultation selected. Start a consultation from a patient's record first.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setMicDenied(true);
      setError("Microphone access was denied. Enable it in your browser settings to record.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorderRef.current = recorder;
    recorder.start();

    setStage("recording");
    setPaused(false);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    levelRef.current = setInterval(() => setLevel(0.15 + Math.random() * 0.85), 140);
  }

  function togglePause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    setPaused((p) => {
      const next = !p;
      if (next) {
        recorder.pause();
        clearInterval(timerRef.current);
        clearInterval(levelRef.current);
      } else {
        recorder.resume();
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        levelRef.current = setInterval(() => setLevel(0.15 + Math.random() * 0.85), 140);
      }
      return next;
    });
  }

  function handleFinishRecording() {
    clearInterval(timerRef.current);
    clearInterval(levelRef.current);
    if (elapsed < 2) {
      setError("Recording is too short. Record at least a few seconds of audio.");
      mediaRecorderRef.current?.stop();
      setStage("idle");
      return;
    }

    const recorder = mediaRecorderRef.current;
    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      await uploadAndTranscribe(blob);
    };
    recorder.stop();
  }

  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      setError("That file doesn't look like an audio recording. Choose an audio or video file.");
      return;
    }
    if (!consultationId) {
      setError("No consultation selected. Start a consultation from a patient's record first.");
      return;
    }
    setError(null);
    setElapsed(0);
    uploadAndTranscribe(file);
  }

  async function uploadAndTranscribe(blob) {
    setStage("uploading");
    try {
      // The backend does upload + synchronous transcription in one call
      // (see the README note on why that should move to a background
      // worker in production). From the UI's perspective this is a
      // single request; we show "transcribing" while it's in flight.
      setStage("transcribing");
      const consultation = await consultationsApi.uploadAudio(consultationId, blob);
      setResult(consultation);
      setStage("ready");
    } catch (err) {
      setError(
        err.status === 500
          ? "Transcription isn't wired up yet on the server (the AI pipeline is still a stub) — the audio upload itself worked."
          : err.message || "Something went wrong processing the recording."
      );
      setStage("failed");
    }
  }

  function handleReset() {
    clearInterval(timerRef.current);
    clearInterval(levelRef.current);
    setStage("idle");
    setPaused(false);
    setElapsed(0);
    setError(null);
    setResult(null);
    setMicDenied(false);
  }

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: theme.ink, background: theme.paper, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${theme.line}`, background: theme.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Stethoscope size={15} color="#FFFFFF" strokeWidth={2.25} />
          </div>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500 }}>Consult</span>
          <ChevronRight size={13} color={theme.inkFaint} />
          <span style={{ fontSize: 13, color: theme.inkMuted }}>New consultation</span>
        </div>
        <StageTracker stage={stage} />
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: theme.brickSoft, border: `1px solid ${theme.brickBorder}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
              <AlertTriangle size={15} color={theme.brick} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: theme.brick, lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 24 }}>
            {stage === "idle" && (
              <div style={{ textAlign: "center" }}>
                <Waveform active={false} level={0} />
                <p style={{ fontSize: 13, color: theme.inkMuted, margin: "8px 0 20px" }}>
                  Start recording, or upload an existing consultation audio file.
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    onClick={startMic}
                    style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 500, color: "#FFFFFF", background: theme.brick, border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
                  >
                    <Mic size={15} strokeWidth={2.25} />
                    Start recording
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 500, color: theme.ink, background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}>
                    <Upload size={15} strokeWidth={2.25} />
                    Upload audio
                    <input type="file" accept="audio/*,video/*" onChange={handleFileUpload} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
            )}

            {stage === "recording" && (
              <div style={{ textAlign: "center" }}>
                <Waveform active={!paused} level={level} />
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 500, color: theme.ink, margin: "10px 0 2px" }}>
                  {formatTime(elapsed)}
                </div>
                <p style={{ fontSize: 12.5, color: paused ? theme.amber : theme.brick, margin: "0 0 20px", fontWeight: 500 }}>
                  {paused ? "Paused" : "Recording in progress"}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    onClick={togglePause}
                    style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 500, color: theme.ink, background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
                  >
                    {paused ? <Play size={15} strokeWidth={2.25} /> : <Pause size={15} strokeWidth={2.25} />}
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={handleFinishRecording}
                    style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 500, color: "#FFFFFF", background: theme.accent, border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
                  >
                    <Square size={14} strokeWidth={2.25} />
                    Finish
                  </button>
                </div>
              </div>
            )}

            {(stage === "uploading" || stage === "transcribing") && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <Loader2 size={22} color={theme.amber} style={{ animation: "spin 1s linear infinite" }} />
                <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
                <p style={{ fontSize: 13.5, color: theme.ink, margin: "12px 0 4px", fontWeight: 500 }}>
                  {stage === "uploading" ? "Uploading audio\u2026" : "Transcribing consultation\u2026"}
                </p>
                <p style={{ fontSize: 12, color: theme.inkFaint, margin: 0 }}>This can take a moment for longer recordings.</p>
              </div>
            )}

            {stage === "failed" && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <p style={{ fontSize: 13.5, color: theme.inkMuted, marginBottom: 18 }}>
                  The recording didn't make it all the way through review — see the message above.
                </p>
                <button
                  onClick={handleReset}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: theme.ink, background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "9px 16px", cursor: "pointer", margin: "0 auto" }}
                >
                  <RotateCcw size={13} strokeWidth={2.25} />
                  Try again
                </button>
              </div>
            )}

            {stage === "ready" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                  <CheckCircle2 size={14} color={theme.accent} />
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: theme.accent }}>Uploaded and processed</span>
                </div>
                <div style={{ border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 12px", background: theme.paper }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={13} color={theme.inkFaint} />
                    <span style={{ fontSize: 12.5, color: theme.ink }}>
                      Status: <strong>{result?.status || "ready_for_review"}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                  <button
                    onClick={handleReset}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: theme.inkMuted, background: "transparent", border: `1px solid ${theme.line}`, borderRadius: 8, padding: "9px 14px", cursor: "pointer" }}
                  >
                    <RotateCcw size={13} strokeWidth={2.25} />
                    Re-record
                  </button>
                  <button
                    onClick={() => {
                      window.location.hash = "queue";
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 500, color: "#FFFFFF", background: theme.accent, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}
                  >
                    Review AI summary
                    <ArrowRight size={14} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
