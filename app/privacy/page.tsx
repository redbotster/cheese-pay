export const metadata = { title: "Privacy · Cheese Pay" };

export default function Privacy() {
  return (<>
    <h1>Privacy Policy</h1>
    <p>Last updated October 2026. This explains what Cheese Pay stores and why.</p>
    <h2>What we store</h2>
    <ul>
      <li>Your email address and 1Claw account ID, from signing in with 1Claw.</li>
      <li>A 1Claw session token, encrypted at rest on our server and never sent to your browser, so we can set up your wallet when you ask.</li>
      <li>Your X user ID and handle, from linking X. We do not keep your X access token and we cannot post as you.</li>
      <li>Your wallet address and the daily limit you approved, so we can send tips within your limits.</li>
      <li>Your chosen limits and a record of each tip: who sent it, who received it, the amount, the status, and the transaction hash.</li>
      <li>A sign-in cookie that keeps you logged in for up to 14 days.</li>
    </ul>
    <h2>What we do not store</h2>
    <p>We never see your passkey or private keys. Your passkey stays on your device and with your passkey provider.</p>
    <h2>Who else sees data</h2>
    <p>Wallet addresses and tip transactions are public on the Base blockchain by design. We use 1Claw for your account, wallet and transactions, X to link your handle, Vercel to host the site, and Turso to store records. We do not sell your data or use it for ads.</p>
    <h2>Your choices</h2>
    <p>You can lower your limits, pause tipping, or ask us to delete your account records. We cannot erase anything written to the blockchain. Contact: <a href="https://1claw.co">1claw.co</a>.</p>
    <p><a href="/">Back to Cheese Pay</a> · <a href="/terms">Terms</a></p>
  </>);
}
