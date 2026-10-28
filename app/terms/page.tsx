export const metadata = { title: "Terms · Cheese Pay" };

export default function Terms() {
  return (<>
    <h1>Terms of Service</h1>
    <p>Last updated October 2026. Cheese Pay lets you send small USDC tips to people on X. By using it, you agree to these terms.</p>
    <h2>What Cheese Pay is</h2>
    <p>Cheese Pay is software. We do not hold your money. Your wallet is a passkey smart wallet on the Base network that only you control. When you set a spending limit, you sign a permission that lets Cheese Pay move USDC out of your wallet up to that limit, and no more. You can lower the limit or pause tipping at any time.</p>
    <h2>Your responsibilities</h2>
    <ul>
      <li>You are responsible for your passkey, your device, and your X account. If someone gets into them, they may be able to spend up to your limits.</li>
      <li>Only tip money you can afford to lose. Blockchain transactions are final. We cannot reverse or refund a tip that has been sent.</li>
      <li>You must be allowed to use crypto where you live, and you must follow the laws that apply to you, including tax rules.</li>
      <li>Do not use Cheese Pay for fraud, harassment, spam, sanctions evasion, or anything illegal.</li>
    </ul>
    <h2>How tips work</h2>
    <p>If the person you tip has no Cheese Pay wallet yet, the tip waits for up to 7 days and nothing is taken from your wallet until they join. If they do not join in time, it expires. Waiting tips count toward your daily limit so you cannot go over it.</p>
    <h2>No guarantees</h2>
    <p>Cheese Pay is provided as is. It can be slow, wrong, or unavailable. Networks, X, and other services we depend on can fail or change. To the extent the law allows, we are not liable for lost funds, missed tips, or other losses from using Cheese Pay. Nothing here is financial, legal, or tax advice.</p>
    <h2>Changes and contact</h2>
    <p>We may update these terms or stop the service. If you keep using Cheese Pay after a change, you accept it. Questions: <a href="https://1claw.co">1claw.co</a>.</p>
    <p><a href="/">Back to Cheese Pay</a> · <a href="/privacy">Privacy</a></p>
  </>);
}
