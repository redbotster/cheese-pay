export const metadata = { title: "Terms · Cheese Pay" };

export default function Terms() {
  return (<>
    <h1>Terms of Service</h1>
    <p>Last updated October 2026. Cheese Pay lets you send small USDC tips to people on X. By using it, you agree to these terms.</p>
    <h2>What Cheese Pay is</h2>
    <p>Cheese Pay is software, powered by 1Claw. Your wallet is a Safe on the Base network whose only owner is your passkey, created through your own 1Claw account. When you approve a daily limit, you sign an onchain allowance that lets the Cheese Pay agent send USDC from your wallet up to that amount per day, and no more. You can lower the limit, pause tipping, or remove the permission at any time.</p>
    <h2>Tips to people without a wallet</h2>
    <p>If you tip someone who has not set up Cheese Pay, the tip moves to a Cheese Pay holding wallet run on 1Claw. It is paid to them when they join, or returned to your wallet after 7 days. While it is held, we are responsible for it.</p>
    <h2>Your responsibilities</h2>
    <ul>
      <li>You are responsible for your passkey, your device, and your X account. If someone gets into them, they may be able to spend up to your limits.</li>
      <li>Only tip money you can afford to lose. Blockchain transactions are final. We cannot reverse or refund a tip that has been sent.</li>
      <li>You must be allowed to use crypto where you live, and you must follow the laws that apply to you, including tax rules.</li>
      <li>Do not use Cheese Pay for fraud, harassment, spam, sanctions evasion, or anything illegal.</li>
    </ul>
    <h2>How tips work</h2>
    <p>Every tip, including one waiting for a new user, counts toward your daily limit, so you cannot go over it. Network fees are paid from your 1Claw account wallet.</p>
    <h2>No guarantees</h2>
    <p>Cheese Pay is provided as is. It can be slow, wrong, or unavailable. Networks, X, and other services we depend on can fail or change. To the extent the law allows, we are not liable for lost funds, missed tips, or other losses from using Cheese Pay. Nothing here is financial, legal, or tax advice.</p>
    <h2>Changes and contact</h2>
    <p>We may update these terms or stop the service. If you keep using Cheese Pay after a change, you accept it. Questions: <a href="https://1claw.co">1claw.co</a>.</p>
    <p><a href="/">Back to Cheese Pay</a> · <a href="/privacy">Privacy</a></p>
  </>);
}
