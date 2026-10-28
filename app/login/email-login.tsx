"use client";
import { useState } from "react";
import { post } from "@/lib/webauthn";

export default function EmailLogin({ expired }: { expired?: boolean }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(expired ? "Your 1Claw session expired. Sign in again to keep going." : ""), [link, setLink] = useState("");

  async function send() {
    setBusy(true); setMsg("");
    const r = await post("/api/auth/email/send", { email });
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Couldn't send a code.");
    setStep("code"); setMsg(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
  }
  async function verify() {
    setBusy(true); setMsg("");
    const r = await post("/api/auth/email/verify", { email, code });
    setBusy(false);
    if (r.ok) return void (location.href = "/setup");
    if (r.link) setLink(r.link);
    setMsg(r.error ?? "That code didn't work.");
  }

  return (<div className="card">
    {step === "email" ? <>
      <b>Sign in with your email</b>
      <p>Cheese Pay wallets are 1Claw wallets. We'll email you a one-time code from 1Claw. No password.</p>
      <p><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", maxWidth: 360 }} /></p>
      <button onClick={send} disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
    </> : <>
      <b>Enter your code</b>
      <p><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ width: 160, letterSpacing: ".3em", fontSize: "1.2rem" }} /></p>
      <button onClick={verify} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>{" "}
      <button className="ghost" onClick={() => { setStep("email"); setCode(""); setMsg(""); }} disabled={busy}>Use a different email</button>
    </>}
    {msg && <p className={link ? "err" : undefined}>{msg}</p>}
    {link && <p><a className="btn" href={link}>Approve Cheese Pay on 1Claw</a></p>}
  </div>);
}
