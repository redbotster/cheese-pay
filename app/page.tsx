import { BASE } from "@/lib/base";
import { getSession } from "@/lib/session";

export default async function Home() {
  const s = await getSession();
  return (<>
    <h1>Cheese Pay 🧀</h1>
    <p>Tip anyone on X. Your wallet is protected by your face or fingerprint, with hard spending limits on every tip.</p>
    <div className="card"><b>How it works</b>
      <ol><li>Sign in with X and create your wallet. It takes a minute and there is no seed phrase to lose.</li>
      <li>Approve a spending limit: <b>$1 per tip and $10 per day to start</b>. You can change both any time, and the daily limit is enforced by the blockchain, not by us.</li>
      <li>Type a friend's X handle and an amount. They get paid in USDC, and we help you let them know.</li></ol></div>
    <p>If your friend has no wallet yet, we invite them and hold the tip for 7 days. Nothing leaves your wallet until they join.</p>
    {s ? <a className="btn" href={`${BASE}/setup`}>Open my wallet</a> : <a className="btn" href={`${BASE}/api/auth/x/login`}>Sign in with X</a>}
  </>);
}
