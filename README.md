# Cheese Pay 🧀

Tip anyone on X: `@1clawAI tip @friend $1`. Deployed at https://cheese-pay.vercel.app. To serve it under `1claw.co/for-ai`, set `NEXT_PUBLIC_BASE_PATH=/for-ai` and rewrite that path to the app.

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
