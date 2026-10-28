"use client";
import { useState } from "react";
import { createPasskey, explain, post, signAndExecute } from "@/lib/webauthn";

type Props = { hasPasskey: boolean; safeAddress: string | null; granted: number; linkedHandle: string | null; gasAddress: string | null };

/** Setup checklist: passkey -> passkey Safe -> daily limit for the Cheese Pay agent -> link X. Each step is a real 1Claw action. */
export default function WalletSteps(p: Props) {
  const [busy, setBusy] = useState(""), [msg, setMsg] = useState(""), [daily, setDaily] = useState(10);
  const run = (name: string, f: () => Promise<unknown>) => async () => {
    setBusy(name); setMsg("");
    try { await f(); location.reload(); } catch (e) { setMsg(explain(e)); } finally { setBusy(""); }
  };

  const steps = [
    { done: p.hasPasskey, title: "Create your passkey", body: "Face ID, Touch ID or your phone. This is the only key to your wallet.",
      action: <button disabled={!!busy} onClick={run("pk", async () => {
        const o = await post("/api/wallet/passkey/begin"); if (!o.ok) throw new Error(o.error);
        const done = await post("/api/wallet/passkey/complete", await createPasskey(o)); if (!done.ok) throw new Error(done.error);
      })}>{busy === "pk" ? "Waiting for you…" : "Create passkey"}</button> },
    { done: !!p.safeAddress, title: "Create your wallet", body: "A Safe on Base owned only by your passkey. Not by us, not by 1Claw.",
      action: <button disabled={!!busy || !p.hasPasskey} onClick={run("safe", async () => { const r = await post("/api/wallet/safe"); if (!r.ok) throw new Error(r.error); })}>{busy === "safe" ? "Creating…" : "Create wallet"}</button> },
    { done: p.granted > 0, title: "Approve a daily limit", body: "Lets Cheese Pay send tips for you, up to this much a day. The blockchain enforces it, and you can remove it any time.",
      action: <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>$ <input type="number" min={1} max={50} step={1} value={daily} onChange={(e) => setDaily(Number(e.target.value))} style={{ width: 80 }} /> a day
        <button disabled={!!busy || !p.safeAddress} onClick={run("grant", () => signAndExecute("/api/wallet/grant", { daily }))}>{busy === "grant" ? "Sign with your passkey…" : "Approve with passkey"}</button></span> },
    { done: !!p.linkedHandle, title: "Link your X account", body: "So friends can tip you by your @handle, and so your tips show who they're from.",
      action: <a className="btn" href="/api/auth/x/login">Link X</a> },
  ];

  return (<div className="card">
    <b>Set up your wallet</b>
    <ol className="steps" style={{ marginTop: 14 }}>
      {steps.map((s) => <li key={s.title} style={{ opacity: s.done ? 0.65 : 1 }}><div>{s.done ? "✓ " : ""}{s.title}<br /><span>{s.body}</span>{!s.done && <div style={{ marginTop: 10 }}>{s.action}</div>}</div></li>)}
    </ol>
    {p.gasAddress && <p style={{ fontSize: ".9rem" }}>1Claw pays network fees from your 1Claw account wallet <code>{p.gasAddress.slice(0, 6)}…{p.gasAddress.slice(-4)}</code>. Keep a little ETH on Base there (about $1 covers hundreds of tips).</p>}
    {msg && <p className="err">{msg}</p>}
  </div>);
}
