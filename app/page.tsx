import { BASE } from "@/lib/base";
import { getSession } from "@/lib/session";
import { Wedge } from "./wedge";

export default async function Home() {
  const s = await getSession();
  return (<>
    <section className="hero">
      <Wedge className="wedge" />
      <div>
        <h1>Tip anyone on X. Easy as cheese.</h1>
        <p>Send a few dollars of USDC to a friend's X handle. Your wallet is locked with your face or fingerprint, and you set the limits.</p>
        {s ? <a className="btn" href={`${BASE}/setup`}>Open my wallet</a> : <a className="btn" href={`${BASE}/api/auth/x/login`}>Sign in with X</a>}
      </div>
    </section>
    <div className="card"><b>How it works</b>
      <ol className="steps" style={{ marginTop: 14 }}>
        <li><div>Sign in and make a wallet<br /><span>One minute, no seed phrase to lose.</span></div></li>
        <li><div>Set your limits<br /><span><b>$1 per tip and $10 per day</b> to start. Change them any time.</span></div></li>
        <li><div>Type a handle and an amount<br /><span>They get paid in USDC. If they're new, we hold the tip for 7 days.</span></div></li>
      </ol>
    </div>
  </>);
}
