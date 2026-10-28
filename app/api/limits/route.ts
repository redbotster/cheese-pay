import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setLimits, userById } from "@/lib/db";
import { CEIL_DAILY, CEIL_MAX_TIP } from "@/lib/config";
import { limitsOf } from "@/lib/tip";

const micro = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? BigInt(Math.round(n * 100)) * 10_000n : 0n; // whole cents only
};

/** Lowering limits or pausing is instant. Raising the daily limit past what the user signed needs a new signature (409). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  const u = s && userById(s.xId);
  if (!s || !u) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  if (!u.wallet) return NextResponse.json({ error: "Create your wallet first." }, { status: 400 });
  const b = await req.json();
  const maxTip = micro(b.maxTip), dailyCap = micro(b.dailyCap);
  const bad = (m: string, status = 400) => NextResponse.json({ error: m }, { status });
  if (maxTip <= 0n || dailyCap <= 0n) return bad("Enter an amount above $0.");
  if (maxTip > CEIL_MAX_TIP) return bad("Per-tip limit can be at most $5.");
  if (dailyCap > CEIL_DAILY) return bad("Daily limit can be at most $50.");
  if (maxTip > dailyCap) return bad("The per-tip limit can't be higher than the daily limit.");
  let signed = 0n;
  try { signed = BigInt(JSON.parse(u.permission!).permission.allowance); } catch { /* treated as nothing signed */ }
  if (dailyCap > signed) return NextResponse.json({ error: "reapprove", signed: signed.toString() }, { status: 409 });
  setLimits(s.xId, maxTip, dailyCap, !!b.paused);
  return NextResponse.json({ ok: true, ...Object.fromEntries(Object.entries(limitsOf(userById(s.xId))).map(([k, v]) => [k, String(v)])) });
}
