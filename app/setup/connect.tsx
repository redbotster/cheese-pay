"use client";
import { useState } from "react";
import { createBaseAccountSDK } from "@base-org/account";
import { requestSpendPermission } from "@base-org/account/spend-permission/browser";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export default function Connect({ spender }: { spender: string }) {
  const [day, setDay] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true); setErr("");
    try {
      const sdk = createBaseAccountSDK({ appName: "Cheese Pay", appChainIds: [8453] });
      const provider = sdk.getProvider();
      // Step 1: passkey smart wallet (creates one with Face ID / fingerprint if this is their first time).
      const [account] = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      // Step 2: one signature that sets the spending limit. $10 a day, enforced by the contract.
      const permission = await requestSpendPermission({
        provider, account, spender, token: USDC, chainId: 8453,
        allowance: BigInt(Math.round(day * 100)) * 10_000n, periodInDays: 1, end: new Date(Date.now() + 365 * 86_400_000),
      });
      const r = await fetch("/for-ai/api/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permission }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Could not save your wallet.");
      location.reload();
    } catch (e) {
      setErr((e as Error).message || "Something went wrong. Nothing was charged.");
    } finally { setBusy(false); }
  }

  return (<div className="card">
    <b>Create your wallet</b>
    <p>You will be asked for Face ID or a fingerprint twice: once to create the wallet, once to approve your daily limit. Start with $10 a day, or pick your own (up to $50). You can change it any time.</p>
    <p>Daily limit $ <input type="number" min="1" max="50" step="1" value={day} onChange={(e) => setDay(Number(e.target.value))} style={{ width: 80, padding: 8, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--fg)", font: "inherit" }} /></p>
    <button onClick={go} disabled={busy}>{busy ? "Waiting for you…" : "Create wallet with passkey"}</button>
    {err && <p style={{ color: "var(--red)" }}>{err}</p>}
  </div>);
}
