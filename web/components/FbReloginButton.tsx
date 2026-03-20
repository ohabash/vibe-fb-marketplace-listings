"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  KeyRound,
  Loader2,
  LogIn,
  RefreshCw,
  Smartphone,
} from "lucide-react";

type Phase =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "needs_code" }
  | { type: "submitting_code" }
  | { type: "checking_approval" }
  | { type: "still_waiting" }
  | { type: "success" }
  | { type: "error"; message: string };

async function callSetup(body: object): Promise<{ status: string; message?: string; error?: string }> {
  const res = await fetch("/api/fb-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function FbReloginButton() {
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  async function startLogin() {
    setPhase({ type: "loading" });
    try {
      const data = await callSetup({ start: true });
      if (data.status === "success") {
        setPhase({ type: "success" });
      } else if (data.status === "needs_code") {
        setPhase({ type: "needs_code" });
        setTimeout(() => codeRef.current?.focus(), 50);
      } else {
        setPhase({ type: "error", message: data.message ?? data.error ?? "Login failed — still on login page" });
      }
    } catch {
      setPhase({ type: "error", message: "Network error — could not reach the server" });
    }
  }

  async function submitCode() {
    if (!code.trim()) return;
    setPhase({ type: "submitting_code" });
    try {
      const data = await callSetup({ code: code.trim() });
      if (data.status === "success") {
        setPhase({ type: "success" });
      } else {
        setPhase({ type: "error", message: data.message ?? "Code rejected — try again" });
      }
    } catch {
      setPhase({ type: "error", message: "Network error" });
    }
  }

  async function checkApproval() {
    setPhase({ type: "checking_approval" });
    try {
      const data = await callSetup({ approved: true });
      if (data.status === "success") {
        setPhase({ type: "success" });
      } else if (data.status === "still_waiting") {
        setPhase({ type: "still_waiting" });
      } else {
        setPhase({ type: "error", message: data.message ?? "Approval check failed" });
      }
    } catch {
      setPhase({ type: "error", message: "Network error" });
    }
  }

  function goToCodeInput() {
    setCode("");
    setPhase({ type: "needs_code" });
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  // ── idle ──────────────────────────────────────────────────────────────────
  if (phase.type === "idle") {
    return (
      <button
        onClick={startLogin}
        className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 transition-colors"
      >
        <LogIn size={11} />
        Re-login to Facebook
      </button>
    );
  }

  // ── loading ───────────────────────────────────────────────────────────────
  if (phase.type === "loading") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 size={12} className="animate-spin" />
        Starting login…
      </span>
    );
  }

  // ── needs_code ────────────────────────────────────────────────────────────
  if (phase.type === "needs_code") {
    return (
      <div className="flex flex-col gap-2 w-full">
        <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
          <KeyRound size={11} className="text-slate-400" />
          FB sent you a verification code
        </p>
        <p className="text-xs text-slate-500">Check your email or SMS.</p>
        <div className="flex gap-1.5">
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCode()}
            placeholder="6-digit code"
            maxLength={8}
            className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 min-w-0 bg-white text-slate-800"
          />
          <button
            onClick={submitCode}
            disabled={!code.trim()}
            className="text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            Submit
          </button>
        </div>
        <button
          onClick={checkApproval}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors self-start"
        >
          <Smartphone size={11} />
          I already logged in / approved in the browser or app
        </button>
      </div>
    );
  }

  // ── submitting_code / checking_approval ───────────────────────────────────
  if (phase.type === "submitting_code" || phase.type === "checking_approval") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 size={12} className="animate-spin" />
        {phase.type === "submitting_code" ? "Verifying code…" : "Checking app approval…"}
      </span>
    );
  }

  // ── still_waiting ─────────────────────────────────────────────────────────
  if (phase.type === "still_waiting") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
          <AlertCircle size={11} />
          Still waiting — approve in the FB app and try again
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={checkApproval}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <RefreshCw size={11} />
            Check again
          </button>
          <button
            onClick={goToCodeInput}
            className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <KeyRound size={11} />
            Enter code instead
          </button>
        </div>
      </div>
    );
  }

  // ── success ───────────────────────────────────────────────────────────────
  if (phase.type === "success") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle size={12} />
        Session saved — try scraping again
      </span>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle size={11} className="shrink-0" />
        {phase.message}
      </span>
      <button
        onClick={startLogin}
        className="self-start flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 transition-colors"
      >
        <LogIn size={11} />
        Try again
      </button>
    </div>
  );
}
