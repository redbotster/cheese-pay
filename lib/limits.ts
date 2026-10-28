import { DAILY_CAP, MAX_TIP } from "./config.ts";

export type Decision = { ok: true } | { ok: false; reason: string };

/**
 * App-side guardrails. The onchain spend permission is the hard stop for the daily cap;
 * this runs first so we reject with a clear message and never submit a doomed transaction.
 */
export function checkTip(p: { amount: bigint; sentLast24h: bigint; selfTip: boolean; hasWallet: boolean; permissionActive: boolean }): Decision {
  if (!p.hasWallet) return { ok: false, reason: "Create your Cheese Pay wallet first." };
  if (!p.permissionActive) return { ok: false, reason: "Your spending permission is not active. Re-approve it on Cheese Pay." };
  if (p.selfTip) return { ok: false, reason: "You can't tip yourself." };
  if (p.amount <= 0n) return { ok: false, reason: "Amount must be more than $0." };
  if (p.amount > MAX_TIP) return { ok: false, reason: "Tips are capped at $1 each." };
  if (p.sentLast24h + p.amount > DAILY_CAP) return { ok: false, reason: "That would pass your $10 daily limit." };
  return { ok: true };
}

export const usd = (n: bigint) => `$${(Number(n) / 1e6).toFixed(2)}`;
