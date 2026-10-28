# Cheese Pay 🧀

Tip anyone on X, from the website: sign in with X, create a passkey wallet, type `@friend` and an amount. Deployed at https://cheesepay.me. To serve it under `1claw.co/for-ai`, set `NEXT_PUBLIC_BASE_PATH=/for-ai` and rewrite that path to the app.

- **Wallet:** self-custodial passkey smart wallet on Base (Base Account). Nobody else holds the key.
- **Limits:** $1 per tip (checked in `lib/limits.ts`), $10 per day (enforced onchain by the user's signed spend permission).
- **Spender:** a 1Claw agent. 1Claw holds its key and enforces guardrails: Base only, only the spend-permission contract and USDC, zero ETH value, daily transaction cap. It never holds user USDC.
- **No wallet yet?** The tip waits up to 7 days, nothing is debited, and the recipient gets one nudge post per week.

## Run
1. `cp .env.example .env.local`, fill X creds (callback `X_REDIRECT_URI` must be registered in the X dev portal), `SESSION_SECRET`, `TWITTER_API_KEY` (optional now).
2. `ONE_CLAW_API_KEY=... node --experimental-strip-types scripts/provision-spender.ts --apply`, then send ~$5 ETH on Base to the printed spender address (gas only).
3. `pnpm dev` (web) and `pnpm watcher` (mentions). `DRY=1 pnpm watcher` parses without sending anything.
4. Optional: mount under another site with `NEXT_PUBLIC_BASE_PATH` plus a rewrite.

`pnpm test` runs parser, limits and engine tests.

## How tips work
- **Web-first.** The website sends tips. X is only used to sign in (and one cached handle lookup per new recipient), which keeps X API costs near zero.
- **Recipient has no wallet?** The tip waits 7 days and counts toward the sender's daily limit; nothing is debited. The sender gets a pre-filled tweet to tell them. The moment the recipient creates a wallet, waiting tips are sent.
- **Optional mention trigger** (`pnpm watcher`): `@1clawAI tip @friend $1`. Quiet by default (replies only on problems). `REPLY_SUCCESS=1` replies on success, `NUDGES=1` posts invites. Every X post costs money, so both are off.
