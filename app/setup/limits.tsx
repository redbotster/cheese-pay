"use client";
import { useState } from "react";
import { post, signAndExecute, explain } from "@/lib/webauthn";

const PRESETS = [{ name: "Cautious", tip: 0.5, day: 5 }, { name: "Default", tip: 1, day: 10 }, { name: "Generous", tip: 5, day: 50 }];

export default function Limits(p: { maxTip: number; dailyCap: number; granted: number; paused: boolean }) {
  const [tip, setTip] = useState(p.maxTip), [day, setDay] = useState(p.dailyCap), [paused, setPaused] = useState(p.paused);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const dirty = tip !== p.maxTip || day !== p.dailyCap || paused !== p.paused;

  async function save() {
    setBusy(true); setMsg("");
    try {
      if (day > p.granted) await signAndExecute("/api/wallet/grant", { daily: day }); // raising: the onchain allowance must be re-signed
      const r = await post("/api/limits", { maxTip: tip, dailyCap: day, paused });
      if (!r.ok) throw new Error(r.error === "reapprove" ? "Approve the higher limit with your passkey first." : r.error);
      setMsg("Saved."); setTimeout(() => location.reload(), 600);
    } catch (e) { setMsg(explain(e)); } finally { setBusy(false); }
  }
  async function removeAgent() {
    if (!confirm("Remove Cheese Pay's permission to send from your wallet? You can approve it again later.")) return;
    setBusy(true); setMsg("");
    try { await signAndExecute("/api/wallet/revoke", {}); location.reload(); } catch (e) { setMsg(explain(e)); } finally { setBusy(false); }
  }

  return (<div className="card">
    <b>Your limits</b>
    <p>Lowering a limit or pausing is instant. Raising the daily limit asks for your passkey, because the blockchain enforces it. Onchain limit now: ${p.granted.toFixed(2)} a day.</p>
    <p>{PRESETS.map((x) => <button key={x.name} className="ghost" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => { setTip(x.tip); setDay(x.day); }} disabled={busy}>{x.name} (${x.tip}/tip, ${x.day}/day)</button>)}</p>
    <p>Max per tip $ <input type="number" min="0.01" max={5} step="0.01" value={tip} onChange={(e) => setTip(Number(e.target.value))} style={{ width: 96 }} />{" "}
      &nbsp; Max per day $ <input type="number" min="1" max={50} step="1" value={day} onChange={(e) => setDay(Number(e.target.value))} style={{ width: 96 }} /></p>
    <p><label><input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause all tipping</label></p>
    <button onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save limits"}</button>{" "}
    <button className="ghost" onClick={removeAgent} disabled={busy}>Remove Cheese Pay's permission</button>
    {msg && <p className={msg === "Saved." ? "okk" : "err"}>{msg}</p>}
  </div>);
}
