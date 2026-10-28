"use client";
import { useState } from "react";
import { BASE } from "@/lib/base";
import { createBaseAccountSDK } from "@base-org/account";
import { requestSpendPermission } from "@base-org/account/spend-permission/browser";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PRESETS = [
  { name: "Cautious", tip: 0.5, day: 5 },
  { name: "Default", tip: 1, day: 10 },
  { name: "Generous", tip: 5, day: 50 },
];

export default function Limits(p: { wallet: string; spender: string; maxTip: number; dailyCap: number; paused: boolean }) {
  const [tip, setTip] = useState(p.maxTip), [day, setDay] = useState(p.dailyCap), [paused, setPaused] = useState(p.paused);
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const dirty = tip !== p.maxTip || day !== p.dailyCap || paused !== p.paused;

  async function save(next = { tip, day, paused }) {
    setBusy(true); setMsg("");
    try {
      const post = () => fetch(`${BASE}/api/limits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxTip: next.tip, dailyCap: next.day, paused: next.paused }) });
      let r = await post();
      if (r.status === 409) { // raising the daily limit: the blockchain limit is what they signed, so sign a new one
        const provider = createBaseAccountSDK({ appName: "Cheese Pay", appChainIds: [8453] }).getProvider();
        const permission = await requestSpendPermission({ provider, account: p.wallet, spender: p.spender, token: USDC, chainId: 8453,
          allowance: BigInt(Math.round(next.day * 100)) * 10_000n, periodInDays: 1, end: new Date(Date.now() + 365 * 86_400_000) });
        const w = await fetch(`${BASE}/api/wallet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permission }) });
        if (!w.ok) throw new Error((await w.json()).error);
        r = await post();
      }
      if (!r.ok) throw new Error((await r.json()).error ?? "Could not save.");
      setMsg("Saved."); setTimeout(() => location.reload(), 600);
    } catch (e) { setMsg((e as Error).message || "Nothing was changed."); } finally { setBusy(false); }
  }

  const num = (v: number, set: (n: number) => void, max: number) => (
    <input type="number" min="0.01" max={max} step="0.01" value={v} onChange={(e) => set(Number(e.target.value))}
      style={{ width: 96 }} />);

  return (<div className="card">
    <b>Your limits</b>
    <p>Pick how much you are comfortable tipping. Lowering limits or pausing is instant. Raising the daily limit asks for your fingerprint again, because the blockchain enforces it.</p>
    <p>{PRESETS.map((x) => <button key={x.name} className="ghost" style={{ marginRight: 8, marginBottom: 8 }}
      onClick={() => { setTip(x.tip); setDay(x.day); }} disabled={busy}>{x.name} (${x.tip}/tip, ${x.day}/day)</button>)}</p>
    <p>Max per tip $ {num(tip, setTip, 5)} &nbsp; Max per day $ {num(day, setDay, 50)}</p>
    <p><label><input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause all tipping</label></p>
    <button onClick={() => save()} disabled={busy || !dirty}>{busy ? "Saving…" : "Save limits"}</button>
    {msg && <p>{msg}</p>}
  </div>);
}
