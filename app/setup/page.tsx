import { redirect } from "next/navigation";
import { BASE } from "@/lib/base";
import { getSession } from "@/lib/session";
import { expireOld, pendingFor, tipsFor, userById } from "@/lib/db";
import { usd } from "@/lib/limits";
import Connect from "./connect";
import Limits from "./limits";
import TipForm from "./tip-form";
import Logout from "../logout";
import { limitsOf } from "@/lib/tip";

export const dynamic = "force-dynamic";

export default async function Setup() {
  const s = await getSession();
  if (!s) redirect("/");
  await expireOld(true); // web tips nobody claimed in 7 days
  const u = await userById(s.xId);
  const waiting = await pendingFor(s.xId);
  const tips = await tipsFor(s.xId);
  return (<>
    <h1>Your wallet</h1>
    <p>Signed in as @{s.handle}.</p>
    {waiting.length > 0 && !u?.wallet && <div className="card"><b>You have {waiting.length} tip{waiting.length > 1 ? "s" : ""} waiting.</b> Create your wallet below and {waiting.length > 1 ? "they land" : "it lands"} right away.</div>}
    {u?.wallet
      ? <><div className="card"><b>Ready.</b> Wallet <code>{u.wallet.slice(0, 6)}…{u.wallet.slice(-4)}</code> on Base. Add USDC on Base to this address to start tipping.</div>
          <TipForm maxTip={Number(limitsOf(u).maxTip) / 1e6} />
          <Limits wallet={u.wallet} spender={process.env.NEXT_PUBLIC_SPENDER_ADDRESS!} maxTip={Number(limitsOf(u).maxTip) / 1e6} dailyCap={Number(limitsOf(u).dailyCap) / 1e6} paused={limitsOf(u).paused} /></>
      : <Connect spender={process.env.NEXT_PUBLIC_SPENDER_ADDRESS!} />}
    <h2>Activity</h2>
    {tips.length === 0 ? <p>No tips yet.</p> : <table><tbody>{tips.map((t) => (
      <tr key={t.id}><td>{t.from_x === s.xId ? `You to @${t.to_handle}` : "Received"}</td><td>{usd(BigInt(t.amount))}</td><td>{t.status}{t.reason ? `: ${t.reason}` : ""}</td></tr>))}</tbody></table>}
    <h2>Security</h2>
    <div className="card"><p>Lost a device or signed in somewhere you don't trust? This ends every Cheese Pay session, including this one.</p><Logout everywhere label="Log out of all devices" /></div>
    <p><a href={BASE || "/"}>Home</a></p>
  </>);
}
