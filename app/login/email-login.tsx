"use client";
import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/webauthn";

export default function EmailLogin({ expired }: { expired?: boolean }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(expired ? "Your 1Claw session expired. Sign in again to keep going." : ""), [link, setLink] = useState("");
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function send(note?: string) {
    setBusy(true); setMsg("");
    const r = await post("/api/auth/email/send", { email });
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Couldn't send a code.");
    setStep("code"); setCode("");
    setMsg(note ?? `We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
  }
  async function verify() {
    setBusy(true); setMsg("");
    const r = await post("/api/auth/email/verify", { email, code });
    setBusy(false);
    if (r.ok) return void (location.href = "/setup");
    if (r.link) return setLink(r.link);
    setMsg(r.error ?? "That code didn't work.");
  }

  // Approval happens on 1Claw in a popup. When it closes we email a fresh code, since the first one is used up.
  function approve() {
    const w = 520, h = 680;
    const pop = window.open(link, "oneclaw-approve", `popup,width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`);
    if (!pop) return void (location.href = link); // popup blocked: go there in this tab instead
    setWaiting(true);
    timer.current = setInterval(() => {
      if (!pop.closed) return;
      if (timer.current) clearInterval(timer.current);
      setWaiting(false); setLink("");
      send(`Thanks. We sent a new code to ${email} so you can finish signing in.`);
    }, 600);
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
      <button onClick={verify} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>{" "}
      <button className="ghost" onClick={() => send(`We sent a new code to ${email}. Use the newest one.`)} disabled={busy}>Send a new code</button>{" "}
      <button className="ghost" onClick={() => { setStep("email"); setCode(""); setMsg(""); }} disabled={busy}>Use a different email</button>
    </>}
    {msg && <p>{msg}</p>}

    {link && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="approve-title">
      <div className="card">
        <b id="approve-title">Approve Cheese Pay on 1Claw</b>
        <p>You already have a 1Claw account. Cheese Pay needs your OK to use it. A 1Claw window will open. Approve there, close it, and we'll take it from here.</p>
        {waiting
          ? <p><b>Waiting for you to approve in the 1Claw window…</b></p>
          : <p><button onClick={approve}>Open 1Claw</button>{" "}<button className="ghost" onClick={() => setLink("")}>Cancel</button></p>}
      </div>
    </div>}
  </div>);
}
