import { BASE } from "@/lib/base";
import { getSession } from "@/lib/session";
import { Wedge } from "./wedge";

const features = [
  { t: "Locked with your face", d: "Your wallet is a passkey. No seed phrase, no password, nothing to lose in a notes app." },
  { t: "Limits you set", d: "$1 a tip and $10 a day to start. Lower them or pause any time, instantly." },
  { t: "Friends don't need a wallet", d: "Tip any @handle. If they're new, the tip waits 7 days for them to join." },
];

export default async function Home() {
  const s = await getSession();
  const cta = s ? <a className="btn" href={`${BASE}/setup`}>Open my wallet</a> : <a className="btn" href={`${BASE}/login`}>Get started</a>;
  return (<>
    <section className="hero">
      <Wedge className="wedge" />
      <div>
        <span className="pill">USDC on Base</span>
        <h1>Tip anyone on X. Easy as cheese.</h1>
        <p>Send a dollar to the person who made your day. Type their handle, touch your fingerprint, done.</p>
        {cta}
      </div>
    </section>

    <div className="preview" aria-hidden="true">
      <div className="row"><span className="who">@you</span><span className="arrow">→</span><span className="who">@friend</span><span className="amt">$1.00</span></div>
      <div className="row sub"><span className="dot" /> Sent. Daily limit left: $9.00</div>
    </div>

    <div className="grid">
      {features.map((f) => <div className="card feature" key={f.t}><b>{f.t}</b><p>{f.d}</p></div>)}
    </div>

    <h2>How it works</h2>
    <div className="card">
      <ol className="steps">
        <li><div>Sign in with your email<br /><span>Your wallet is a 1Claw wallet. No password, just a one-time code.</span></div></li>
        <li><div>Make your passkey wallet and link X<br /><span>One minute with Face ID or a fingerprint, then connect your @handle.</span></div></li>
        <li><div>Add a little USDC and start tipping<br /><span>Every tip stays inside the limits you chose.</span></div></li>
      </ol>
    </div>

    <div className="card note">
      <b>Built for safety first.</b>
      <p>Tips can only move inside your limits, and the daily limit is enforced onchain, not just by our servers. You can log out of every device in one tap.</p>
    </div>

    <p style={{ textAlign: "center", marginTop: 28 }}>{cta}</p>
  </>);
}
