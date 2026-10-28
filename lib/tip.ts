import type { Address } from "viem";
import { DEFAULT_DAILY, DEFAULT_MAX_TIP, PENDING_TTL_MS } from "./config.ts";
import { checkTip, usd } from "./limits.ts";
import { claimTip, escrowedExpired, memberById, memberByX, pendingEscrowFor, sentLast24h, setTip, setTipMode, setTipRelease, tipByTweet, type Member, type Tip } from "./db.ts";
import { ESCROW, payFromEscrow, spendFromSafe } from "./oneclaw.ts";

/** The user's own limits. The daily cap can never exceed the allowance they granted onchain. */
export function limitsOf(m?: Member) {
  const granted = m?.grant_status === "active" && m.grant_amount ? BigInt(m.grant_amount) : 0n;
  const mine = m?.daily_cap ? BigInt(m.daily_cap) : DEFAULT_DAILY;
  return { maxTip: m?.max_tip ? BigInt(m.max_tip) : DEFAULT_MAX_TIP, dailyCap: mine < granted ? mine : granted, granted, paused: !!m?.paused };
}

export type Outcome = { kind: "sent"; txHash: string } | { kind: "pending" } | { kind: "rejected"; reason: string } | { kind: "duplicate" };
export type Spend = { fromSafe: typeof spendFromSafe; fromEscrow: typeof payFromEscrow };
const live: Spend = { fromSafe: spendFromSafe, fromEscrow: payFromEscrow };

/**
 * One tip from a member's passkey Safe. If the recipient has a wallet, it goes straight to them.
 * If not, it moves to escrow (the agent's own key) and is paid out when they join, or refunded after 7 days.
 * Safe to call twice with the same key: the second call is a no-op.
 */
export async function sendTip(a: { from: Member; toX: string; toHandle: string; amount: bigint; key: string }, spend: Spend = live): Promise<Outcome> {
  const recipient = await memberByX(a.toX);
  const direct = !!recipient?.safe_address;
  const tweetId = `web:${a.from.uid}:${a.key}`;
  if (!(await claimTip(tweetId, a.from.x_id ?? a.from.uid, a.toX, a.toHandle, a.amount, direct ? null : Date.now() + PENDING_TTL_MS))) return { kind: "duplicate" };
  const tip = (await tipByTweet(tweetId))!;
  const lim = limitsOf(a.from);
  const v = checkTip({
    amount: a.amount, sentLast24h: await sentLast24h(tip.from_x, tip.id), selfTip: a.from.x_id === a.toX,
    hasWallet: !!a.from.safe_id, grantActive: lim.granted > 0n, maxTip: lim.maxTip, dailyCap: lim.dailyCap, paused: lim.paused,
  });
  if (!v.ok) { await setTip(tip.id, "rejected", null, v.reason); return { kind: "rejected", reason: v.reason }; }
  await setTip(tip.id, "sending"); // counted against the daily limit from this moment
  try {
    const tx = await spend.fromSafe(a.from.safe_id!, (direct ? recipient!.safe_address : ESCROW()) as Address, a.amount);
    if (direct) { await setTip(tip.id, "sent", tx); return { kind: "sent", txHash: tx }; }
    await setTipMode(tip.id, "escrow"); await setTip(tip.id, "pending", tx);
    return { kind: "pending" };
  } catch (e) {
    await setTip(tip.id, "failed", null, String((e as Error).message).slice(0, 200));
    return { kind: "rejected", reason: "The payment didn't go through. Nothing was charged." };
  }
}

/** A recipient now has a wallet: pay out everything held for them. */
export async function releaseEscrow(toX: string, spend: Spend = live): Promise<Array<{ tip: Tip; ok: boolean }>> {
  const to = await memberByX(toX);
  const out: Array<{ tip: Tip; ok: boolean }> = [];
  if (!to?.safe_address) return out;
  for (const tip of await pendingEscrowFor(toX)) {
    await setTipRelease(tip.id, "releasing", null);
    try { await setTipRelease(tip.id, "sent", await spend.fromEscrow(to.safe_address as Address, BigInt(tip.amount))); out.push({ tip, ok: true }); }
    catch (e) { await setTipRelease(tip.id, "pending", null, String((e as Error).message).slice(0, 200)); out.push({ tip, ok: false }); } // retried next time
  }
  return out;
}

/** Tips nobody claimed in 7 days go back to the sender's Safe. */
export async function refundExpired(spend: Spend = live): Promise<number> {
  let n = 0;
  for (const tip of await escrowedExpired()) {
    const sender = (await memberByX(tip.from_x)) ?? (await memberById(tip.from_x));
    if (!sender?.safe_address) continue;
    await setTipRelease(tip.id, "refunding", null);
    try { await setTipRelease(tip.id, "refunded", await spend.fromEscrow(sender.safe_address as Address, BigInt(tip.amount))); n++; }
    catch (e) { await setTipRelease(tip.id, "pending", null, String((e as Error).message).slice(0, 200)); }
  }
  return n;
}

export { usd };
