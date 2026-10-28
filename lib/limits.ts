export type Decision = { ok: true } | { ok: false; reason: string };

export const usd = (n: bigint) => `$${(Number(n) / 1e6).toFixed(2)}`;

/**
 * App-side guardrails, using the user's own limits. The onchain grant (Safe Allowance Module) is the hard stop for
 * the daily total; this runs first so we reject with a clear message and never submit a doomed transaction.
 */
export function checkTip(p: {
  amount: bigint; sentLast24h: bigint; selfTip: boolean; hasWallet: boolean; grantActive: boolean;
  maxTip: bigint; dailyCap: bigint; paused: boolean;
}): Decision {
  if (!p.hasWallet) return { ok: false, reason: "Create your Cheese Pay wallet first." };
  if (p.paused) return { ok: false, reason: "Your tipping is paused. Turn it back on in Cheese Pay." };
  if (!p.grantActive) return { ok: false, reason: "Approve a daily limit for your wallet first." };
  if (p.selfTip) return { ok: false, reason: "You can't tip yourself." };
  if (p.amount <= 0n) return { ok: false, reason: "Amount must be more than $0." };
  if (p.amount > p.maxTip) return { ok: false, reason: `Your limit is ${usd(p.maxTip)} per tip. You can change it in Cheese Pay.` };
  if (p.sentLast24h + p.amount > p.dailyCap) return { ok: false, reason: `That would pass your ${usd(p.dailyCap)} daily limit.` };
  return { ok: true };
}
