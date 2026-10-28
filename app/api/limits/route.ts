import { guard, json } from "@/lib/api";
import { getSession } from "@/lib/session";
import { memberById, setLimits } from "@/lib/db";
import { CEIL_DAILY, CEIL_MAX_TIP } from "@/lib/config";
import { limitsOf } from "@/lib/tip";

const micro = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? BigInt(Math.round(n * 100)) * 10_000n : 0n;
};

/** Lowering limits or pausing is instant. Raising the daily limit past the onchain grant needs a new passkey-signed grant (409). */
export async function POST(req: Request) {
  const no = await guard(req, "limits", 10, 60); if (no) return no;
  const s = await getSession();
  const m = s && (await memberById(s.uid));
  if (!s || !m) return json({ error: "Sign in first." }, 401);
  const b = await req.json().catch(() => ({}));
  const maxTip = micro(b.maxTip), dailyCap = micro(b.dailyCap);
  if (maxTip <= 0n || dailyCap <= 0n) return json({ error: "Enter an amount above $0." }, 400);
  if (maxTip > CEIL_MAX_TIP) return json({ error: "Per-tip limit can be at most $5." }, 400);
  if (dailyCap > CEIL_DAILY) return json({ error: "Daily limit can be at most $50." }, 400);
  if (maxTip > dailyCap) return json({ error: "The per-tip limit can't be higher than the daily limit." }, 400);
  if (dailyCap > limitsOf(m).granted) return json({ error: "reapprove" }, 409);
  await setLimits(s.uid, maxTip, dailyCap, !!b.paused);
  return json({ ok: true });
}
