"use client";
import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/webauthn";
import { APPROVING, CHANNEL } from "../approval-return";

const COOLDOWN = 30;

export default function EmailLogin({ expired }: { expired?: boolean }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(expired ? "Your 1Claw session expired. Sign in again to keep going." : ""), [link, setLink] = useState("");
  const [waiting, setWaiting] = useState(false), [notYet, setNotYet] = useState(false), [wait, setWait] = useState(0);
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
  async function verify(quiet = false) {
    setBusy(true); if (!quiet) setMsg("");
    const r = await post("/api/auth/email/verify", { email, code });
    setBusy(false);
    if (r.ok) { location.href = "/setup"; return "ok"; }
    if (r.link) { setLink(r.link); return "link"; }
    if (!quiet) setMsg(r.error ?? "That code didn't work.");
    return "bad";
  }

  // Approval happens on 1Claw in a popup. When it closes, try the same code again first,
  // and only email a new one if that code is used up.
  function approve() {
    const w = 520, h = 720;
    try { localStorage.setItem(APPROVING, String(Date.now())); sessionStorage.setItem(APPROVING, "1"); } catch {}
    const pop = window.open(link, "oneclaw-approve", `popup,width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`);
    if (!pop) return void (location.href = link); // popup blocked: go there in this tab instead
    setWaiting(true); setNotYet(false);
    let done = false, ch: BroadcastChannel | null = null;
    const finish = async () => {
      if (done) return; done = true;
      if (timer.current) clearInterval(timer.current);
      ch?.close();
      try { localStorage.removeItem(APPROVING); sessionStorage.removeItem(APPROVING); } catch {}
      try { pop.close(); } catch {}
      setWaiting(false);
      const res = await verify(true);
      if (res === "link") return setNotYet(true); // closed before approving: no new email, just ask again
      setLink("");
      if (res === "bad") send(`Approved. We sent a new code to ${email} to finish signing in.`);
    };
    try { ch = new BroadcastChannel(CHANNEL); ch.onmessage = (e) => { if (e.data === "approved" || e.data === "denied") finish(); }; } catch {}
    timer.current = setInterval(() => { if (pop.closed) finish(); }, 800);
  }

  return (<div className="card">
    {step === "email" ? <>
      <b>Sign in with your email</b>
      <p>Cheese Pay wallets are 1Claw wallets. We'll email you a one-time code from 1Claw. No password.</p>
      <p><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", maxWidth: 360 }} /></p>
      <button onClick={() => send()} disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
    </> : <>
      <b>Enter your code</b>
      <p><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ width: 160, letterSpacing: ".3em", fontSize: "1.2rem" }} /></p>
      <button onClick={() => verify()} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>{" "}
      <button className="ghost" onClick={() => send(`We sent a new code to ${email}. Use the newest one.`)} disabled={busy || wait > 0}>{wait > 0 ? `New code in ${wait}s` : "Send a new code"}</button>{" "}
      <button className="ghost" onClick={() => { setStep("email"); setCode(""); setMsg(""); }} disabled={busy}>Use a different email</button>
      <p className="muted">Not seeing it? Check spam for an email from 1Claw.</p>
    </>}
    {msg && <p>{msg}</p>}

    {link && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="approve-title">
      <div className="card">
        <b id="approve-title">Approve Cheese Pay on 1Claw</b>
        {notYet
          ? <p>1Claw doesn't show the approval yet. In the 1Claw window, sign in to your 1Claw account if it asks, then tap Approve before closing it.</p>
          : <p>You already have a 1Claw account. Cheese Pay needs your OK to use it. A 1Claw window will open. Sign in if it asks, tap Approve, then close it. We'll take it from there.</p>}
        {waiting
          ? <p><b>Waiting for you to approve in the 1Claw window…</b></p>
          : <p><button onClick={approve}>{notYet ? "Open 1Claw again" : "Open 1Claw"}</button>{" "}<button className="ghost" onClick={() => { setLink(""); setNotYet(false); }}>Cancel</button></p>}
      </div>
    </div>}
  </div>);
}
