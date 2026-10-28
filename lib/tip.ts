import { createPublicClient, http, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { createClient } from "@1claw/sdk";
import { prepareSpendCallData, getPermissionStatus } from "@base-org/account/spend-permission/node";
import { DEFAULT_DAILY, DEFAULT_MAX_TIP, PENDING_TTL_MS } from "./config.ts";
import { checkTip, usd } from "./limits.ts";
import { claimTip, pendingFor, sentLast24h, setTip, tipByTweet, userById, type Tip, type User } from "./db.ts";

const rpcUrl = () => process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
/** The spender is a 1Claw agent: 1Claw holds the key and enforces guardrails (Base only, USDC + spend-permission contract only, zero ETH value). */
const oneclaw = () => createClient({ baseUrl: process.env.ONECLAW_API_BASE ?? "https://api.1claw.xyz", apiKey: process.env.ONECLAW_SPENDER_API_KEY, agentId: process.env.ONECLAW_SPENDER_AGENT_ID });

/** The user's own limits. The daily cap can never exceed what they signed onchain. */
export function limitsOf(u?: User) {
  let signed = DEFAULT_DAILY;
  try { signed = BigInt(JSON.parse(u?.permission ?? "{}").permission.allowance); } catch { /* no permission yet */ }
  const mine = u?.daily_cap ? BigInt(u.daily_cap) : DEFAULT_DAILY;
  return { maxTip: u?.max_tip ? BigInt(u.max_tip) : DEFAULT_MAX_TIP, dailyCap: mine < signed ? mine : signed, paused: !!u?.paused };
}

export type Outcome = { kind: "sent"; txHash: string } | { kind: "pending" } | { kind: "rejected"; reason: string } | { kind: "duplicate" };

async function permissionActive(u: User, amount: bigint): Promise<boolean> {
  if (!u.permission) return false;
  try {
    const st = await getPermissionStatus(JSON.parse(u.permission), { rpcUrl: rpcUrl() });
    return st.isActive && st.remainingSpend >= amount; // onchain remaining allowance is the hard stop
  } catch { return false; }
}

async function send(from: User, toWallet: Address, amount: bigint): Promise<string> {
  const calls = await prepareSpendCallData(JSON.parse(from.permission!), amount, toWallet, { rpcUrl: rpcUrl() });
  const client = oneclaw();
  const pub = createPublicClient({ chain: base, transport: http(rpcUrl()) });
  let last = "";
  for (const c of calls) { // approve-with-signature (first use), spend, transfer: in order, each must succeed
    const r = await client.agents.submitTransaction(process.env.ONECLAW_SPENDER_AGENT_ID!, {
      to: c.to, data: c.data, value: "0", chain: "base", simulate_first: true, // 1Claw simulates, applies guardrails, signs, broadcasts
    });
    if (!r.data?.tx_hash) throw new Error(r.error?.message ?? r.data?.error_message ?? "1Claw refused the transaction");
    last = r.data.tx_hash;
    const rc = await pub.waitForTransactionReceipt({ hash: last as Hex });
    if (rc.status !== "success") throw new Error("transaction reverted");
  }
  return last;
}

/** Handle one tip request. Safe to call twice for the same tweet: the second call is a no-op. */
export async function handleTip(a: { tweetId: string; fromX: string; toX: string; toHandle: string; amount: bigint }): Promise<Outcome> {
  const recipient = await userById(a.toX);
  const from = await userById(a.fromX);
  const pendingExpiry = recipient?.wallet ? null : Date.now() + PENDING_TTL_MS;
  if (!(await claimTip(a.tweetId, a.fromX, a.toX, a.toHandle, a.amount, pendingExpiry))) return { kind: "duplicate" };
  const tip = (await tipByTweet(a.tweetId))!;
  const reject = async (reason: string): Promise<Outcome> => (await setTip(tip.id, "rejected", null, reason), { kind: "rejected", reason });

  const verdict = checkTip({
    amount: a.amount, sentLast24h: from ? await sentLast24h(a.fromX) : 0n, selfTip: a.fromX === a.toX,
    hasWallet: !!from?.wallet, permissionActive: from ? await permissionActive(from, a.amount) : false, ...limitsOf(from),
  });
  if (!verdict.ok) return reject(verdict.reason);
  if (!recipient?.wallet) { await setTip(tip.id, "pending"); return { kind: "pending" }; } // no money moves until they have a wallet
  return settle(tip, from!, recipient);
}

async function settle(tip: Tip, from: User, to: User): Promise<Outcome> {
  await setTip(tip.id, "sending"); // counted against the daily cap from this moment
  try {
    const tx = await send(from, to.wallet as Address, BigInt(tip.amount));
    await setTip(tip.id, "sent", tx);
    return { kind: "sent", txHash: tx };
  } catch (e) {
    await setTip(tip.id, "failed", null, String((e as Error).message).slice(0, 200));
    return { kind: "rejected", reason: "The payment didn't go through. Nothing was charged." };
  }
}

/** Called after a recipient creates a wallet: send everything that was waiting for them. Re-checks limits at send time. */
export async function releasePending(toX: string): Promise<Array<{ tip: Tip; outcome: Outcome }>> {
  const to = await userById(toX);
  const out: Array<{ tip: Tip; outcome: Outcome }> = [];
  if (!to?.wallet) return out;
  for (const tip of await pendingFor(toX)) {
    const from = await userById(tip.from_x);
    const amount = BigInt(tip.amount);
    const v = checkTip({
      amount, sentLast24h: await sentLast24h(tip.from_x), selfTip: false,
      hasWallet: !!from?.wallet, permissionActive: from ? await permissionActive(from, amount) : false, ...limitsOf(from),
    });
    if (!v.ok) { await setTip(tip.id, "rejected", null, v.reason); out.push({ tip, outcome: { kind: "rejected", reason: v.reason } }); continue; }
    out.push({ tip, outcome: await settle(tip, from!, to) });
  }
  return out;
}

export { usd };
