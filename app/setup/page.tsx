import { redirect } from "next/navigation";
import { getSession, userToken } from "@/lib/session";
import { memberById, tipsFor, type Member } from "@/lib/db";
import { listPasskeys, treasuryWallets } from "@/lib/oneclaw";
import { usd } from "@/lib/limits";
import { limitsOf } from "@/lib/tip";
import WalletSteps from "./wallet-steps";
import Limits from "./limits";
import TipForm from "./tip-form";
import Logout from "../logout";

export const dynamic = "force-dynamic";

export default async function Setup() {
  const s = await getSession();
  if (!s) redirect("/login");
  const m = (await memberById(s.uid)) as Member;
  const token = await userToken();
  if (!token && !(m?.safe_address && m.grant_status === "active" && m.x_id)) redirect("/login?expired=1"); // setup needs a live 1Claw session
  let hasPasskey = !!m?.safe_id, gas: string | null = null;
  if (token) {
    try { hasPasskey = hasPasskey || (await listPasskeys(token)).length > 0; } catch { /* shown as not done */ }
    try { gas = (await treasuryWallets(token)).find((w) => w.chain === "base" || w.chain === "ethereum")?.address ?? null; } catch { /* optional */ }
  }
  const lim = limitsOf(m);
  const ready = !!m?.safe_address && lim.granted > 0n && !!m.x_id;
  const tips = m?.x_id ? await tipsFor(m.x_id) : [];
  const status: Record<string, string> = { sent: "Sent", pending: "Waiting for them to join", rejected: "Not sent", failed: "Failed, nothing charged", refunded: "Refunded", sending: "Sending", releasing: "Paying out", refunding: "Refunding" };

  return (<>
    <h1>Your wallet</h1>
    <p>{m?.handle ? `@${m.handle} · ` : ""}{m?.email}</p>
    {!ready && <WalletSteps hasPasskey={hasPasskey} safeAddress={m?.safe_address ?? null} granted={Number(lim.granted) / 1e6} linkedHandle={m?.handle ?? null} gasAddress={gas} />}
    {m?.safe_address && <div className="card"><b>Wallet</b> <code>{m.safe_address.slice(0, 6)}…{m.safe_address.slice(-4)}</code> on Base. Add USDC on Base to this address to start tipping.</div>}
    {ready && <TipForm maxTip={Number(lim.maxTip) / 1e6} />}
    {lim.granted > 0n && <Limits maxTip={Number(lim.maxTip) / 1e6} dailyCap={Number(lim.dailyCap) / 1e6} granted={Number(lim.granted) / 1e6} paused={lim.paused} />}
    <h2>Activity</h2>
    {tips.length === 0 ? <p>No tips yet.</p> : <table><tbody>{tips.map((t) => (
      <tr key={t.id}><td>{t.from_x === m?.x_id ? `You to @${t.to_handle}` : "Received"}</td><td>{usd(BigInt(t.amount))}</td><td>{status[t.status] ?? t.status}{t.reason && t.status !== "sent" ? `: ${t.reason}` : ""}</td></tr>))}</tbody></table>}
    <h2>Security</h2>
    <div className="card"><p>Lost a device or signed in somewhere you don't trust? This ends every Cheese Pay session, including this one. To stop all sending, use "Remove Cheese Pay's permission" above.</p><Logout everywhere label="Log out of all devices" /></div>
  </>);
}
