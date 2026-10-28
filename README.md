# Cheese Pay 🧀

Tip anyone on X in USDC on Base. Powered by 1Claw. Live at https://cheesepay.me.

## How it works
- **Sign in** with your email through 1Claw (one-time code). Your 1Claw token is sealed with AES-256-GCM on the server and never reaches the browser.
- **Wallet:** a 1Claw passkey Safe on Base. Its only owner is your passkey (Safe's WebAuthn signer). Nobody else holds a key.
- **Daily limit:** you sign a Safe Allowance Module grant for the Cheese Pay agent. The cap is enforced onchain; the agent also runs under 1Claw guardrails (Base only, USDC only, zero ETH value, daily transaction cap).
- **Per-tip limit and pause** are enforced by the app before anything is sent. Lowering limits is instant; raising the daily limit needs your passkey.
- **Recipient without a wallet:** the tip moves to escrow (the agent's key) and is paid out when they join, or refunded after 7 days by a daily cron.
- **X** is linked for identity only (who you are on X, who you are tipping). X is never a way to sign in.

## Security
Revocable server-side sessions (`__Host-` cookie), log out everywhere, same-origin checks on every write, rate limits that fail closed,
strict CSP (the browser talks only to this site), HSTS, frame-deny, no-store on signed-in pages. Prepared Safe transactions are kept
server-side, single-use and expire in 5 minutes, so the browser can only supply a passkey signature, never change what is signed.

## Passkey domain
1Claw binds passkeys to the domain they were created on. Passkey steps work where 1Claw accepts the site origin. See the open questions to the 1Claw team.

## Run
`pnpm dev`, `pnpm test`. Env: see `.env.example`.
