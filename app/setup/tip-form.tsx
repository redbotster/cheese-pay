"use client";
import { useState } from "react";
import { BASE } from "@/lib/base";

export default function TipForm({ maxTip }: { maxTip: number }) {
  const [to, setTo] = useState(""), [amount, setAmount] = useState(Math.min(1, maxTip));
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [share, setShare] = useState("");

  async function send() {
    setBusy(true); setMsg(""); setShare("");
    try {
      const r = await fetch(`${BASE}/api/tip`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, amount, key: crypto.randomUUID() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong. Nothing was charged.");
      setMsg(j.status === "sent" ? `Sent $${amount.toFixed(2)} to @${j.toHandle}.`
        : `@${j.toHandle} isn't on Cheese Pay yet. Your $${amount.toFixed(2)} is held safely for 7 days, and comes back to you if they don't join. Tell them:`);
      setShare(j.shareUrl);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (<div className="card">
    <b>Send a tip</b>
    <p>Tip anyone on X. They don't need a wallet yet.</p>
    <p><input placeholder="@handle" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 180 }} />
      {" "}$ <input type="number" min="0.01" max={maxTip} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 90 }} /></p>
    <button onClick={send} disabled={busy || !to.trim() || !(amount > 0)}>{busy ? "Sending…" : "Send tip"}</button>
    {msg && <p>{msg}</p>}
    {share && <p><a className="btn" href={share} target="_blank" rel="noreferrer">Post on X to tell them</a></p>}
  </div>);
}
