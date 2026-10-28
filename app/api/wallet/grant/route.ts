import { fail, guard, json } from "@/lib/api";
import { savePending, signable, walletCtx } from "@/lib/wallet-api";
import { prepareGrant } from "@/lib/oneclaw";
import { CEIL_DAILY } from "@/lib/config";

/** Prepares the daily allowance for the Cheese Pay agent. Nothing happens until the user signs it with their passkey. */
export async function POST(req: Request) {
  const no = await guard(req, "grant", 6, 60); if (no) return no;
  const c = await walletCtx(); if ("error" in c) return c.error;
  if (!c.member?.safe_id) return json({ error: "Create your wallet first." }, 400);
  const daily = Number((await req.json().catch(() => ({}))).daily);
  if (!Number.isFinite(daily) || daily < 1 || daily > Number(CEIL_DAILY) / 1e6) return json({ error: "Pick a daily limit between $1 and $50." }, 400);
  const amount = BigInt(Math.round(daily * 100)) * 10_000n;
  try {
    const r = await prepareGrant(c.token, c.member.safe_id, amount);
    await savePending(c.s.sid, { kind: "grant", safeId: c.member.safe_id, prepare: { ...r.prepare, grant_id: r.prepare.grant_id ?? r.grant.id }, amount: amount.toString() });
    return json(signable(r.prepare));
  } catch (e) { return fail(e); }
}
