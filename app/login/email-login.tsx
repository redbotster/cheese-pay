"use client";
import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/webauthn";
import { APPROVING, CHANNEL } from "@/lib/approval";

const COOLDOWN = 30;

export default function EmailLogin({ expired }: { expired?: boolean }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(expired ? "Your 1Claw session expired. Sign in again to keep going." : "");
  const [existing, setExisting] = useState(false), [waiting, setWaiting] = useState(false), [wait, setWait] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function send(note?: string) {
    setBusy(true); setMsg("");
    const r = await post("/api/auth/email/send", { email });
    setBusy(false);
    if (r.ok || r.codeStep) { setStep("code"); setCode(""); setWait(COOLDOWN); }
    if (!r.ok) return setMsg(r.error ?? "Couldn't send a code.");
    setMsg(note ?? `We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
  }
  async function verify() {
    setBusy(true); setMsg("");
    const r = await post("/api/auth/email/verify", { email, code });
    setBusy(false);
    if (r.ok) return void (location.href = "/setup");
    if (r.link) return setExisting(true); // already a 1Claw user: sign in with 1Claw instead of a code
    setMsg(r.error ?? "That code didn't work.");
  }

  // Existing 1Claw users sign in on 1Claw's own page in a popup. It reports back here and closes itself.
  function signInWith1Claw() {
    const w = 520, h = 720, url = `/api/auth/oneclaw/start${email ? `?email=${encodeURIComponent(email)}` : ""}`;
    try { localStorage.setItem(APPROVING, String(Date.now())); sessionStorage.setItem(APPROVING, "1"); } catch {}
    const pop = window.open(url, "oneclaw-signin", `popup,width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`);
    if (!pop) return void (location.href = url); // popup blocked: do it in this tab
    setWaiting(true); setMsg("");
    let done = false, ch: BroadcastChannel | null = null;
    const finish = (result: string) => {
      if (done) return; done = true;
      if (timer.current) clearInterval(timer.current);
      ch?.close();
      try { localStorage.removeItem(APPROVING); sessionStorage.removeItem(APPROVING); } catch {}
      setWaiting(false);
      if (result === "signedin") return void (location.href = "/setup");
      if (result !== "closed") setMsg("1Claw sign-in didn't finish. Try again.");
    };
    try { ch = new BroadcastChannel(CHANNEL); ch.onmessage = (e) => finish(String(e.data)); } catch {}
    timer.current = setInterval(() => { if (pop.closed) setTimeout(() => finish("closed"), 1500); }, 800);
  }

  const oneclawButton = <button className={existing ? undefined : "ghost"} onClick={signInWith1Claw} disabled={waiting}>{waiting ? "Waiting for 1Claw…" : "Sign in with 1Claw"}</button>;

  return (<div className="card">
    {step === "email" ? <>
      <b>Sign in with your email</b>
      <p>Cheese Pay wallets are 1Claw wallets. We'll email you a one-time code from 1Claw. No password.</p>
      <p><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", maxWidth: 360 }} /></p>
      <button onClick={() => send()} disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>{" "}
      {oneclawButton}
      <p className="muted">Already use 1Claw? Sign in with 1Claw and skip the code.</p>
    </> : <>
      <b>Enter your code</b>
      <p><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ width: 160, letterSpacing: ".3em", fontSize: "1.2rem" }} /></p>
      <button onClick={verify} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>{" "}
      <button className="ghost" onClick={() => send(`We sent a new code to ${email}. Use the newest one.`)} disabled={busy || wait > 0}>{wait > 0 ? `New code in ${wait}s` : "Send a new code"}</button>{" "}
      <button className="ghost" onClick={() => { setStep("email"); setCode(""); setMsg(""); }} disabled={busy}>Use a different email</button>
      <p className="muted">Not seeing it? Check spam for an email from 1Claw.</p>
    </>}
    {msg && <p>{msg}</p>}

    {existing && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="oc-title">
      <div className="card">
        <b id="oc-title">You already have a 1Claw account</b>
        <p>Sign in with it instead. A 1Claw window will open. Sign in there and approve Cheese Pay, and you'll come right back here, signed in.</p>
        <p>{oneclawButton}{" "}<button className="ghost" onClick={() => setExisting(false)} disabled={waiting}>Cancel</button></p>
      </div>
    </div>}
  </div>);
}
