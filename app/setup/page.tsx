import { redirect } from "next/navigation";
import { BASE } from "@/lib/base";
import { getSession } from "@/lib/session";
import { tipsFor, userById } from "@/lib/db";
import { usd } from "@/lib/limits";
import Connect from "./connect";
import Limits from "./limits";
import { limitsOf } from "@/lib/tip";

export const dynamic = "force-dynamic";

export default async function Setup() {
  const s = await getSession();
  if (!s) redirect("/");
  const u = await userById(s.xId);
  const tips = await tipsFor(s.xId);
  return (<>
    <h1>Your wallet 🧀</h1>
    <p>Signed in as @{s.handle}.</p>
    {u?.wallet
      ? <><div className="card"><b>Ready.</b> Wallet <code>{u.wallet.slice(0, 6)}…{u.wallet.slice(-4)}</code> on Base.
          <p>Add USDC on Base to this address, then tweet <code>@1clawAI tip @friend $1</code>.</p></div>
          <Limits wallet={u.wallet} spender={process.env.NEXT_PUBLIC_SPENDER_ADDRESS!} maxTip={Number(limitsOf(u).maxTip) / 1e6} dailyCap={Number(limitsOf(u).dailyCap) / 1e6} paused={limitsOf(u).paused} /></>
      : <Connect spender={process.env.NEXT_PUBLIC_SPENDER_ADDRESS!} />}
    <h2>Activity</h2>
    {tips.length === 0 ? <p>No tips yet.</p> : <table><tbody>{tips.map((t) => (
      <tr key={t.id}><td>{t.from_x === s.xId ? `You to @${t.to_handle}` : "Received"}</td><td>{usd(BigInt(t.amount))}</td><td>{t.status}{t.reason ? `: ${t.reason}` : ""}</td></tr>))}</tbody></table>}
    <p><a href={BASE || "/"}>Home</a></p>
  </>);
}
