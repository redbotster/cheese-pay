import { NextRequest } from "next/server";
import { guard, json } from "@/lib/api";
import { getSession } from "@/lib/session";
import { memberById } from "@/lib/db";
import { webTip } from "@/lib/webtip";
import { usd } from "@/lib/limits";
import { allow } from "@/lib/security";

export const maxDuration = 60; // an onchain send waits for confirmation

const micro = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? BigInt(Math.round(n * 100)) * 10_000n : 0n; // whole cents only
};

export async function POST(req: NextRequest) {
  const no = await guard(req, "tip", 30, 60); if (no) return no;
  const s = await getSession();
  if (!s) return json({ error: "Sign in first." }, 401);
  if (!(await allow(`tip:${s.uid}`, 12, 60)) || !(await allow(`tipday:${s.uid}`, 300, 86400))) return json({ error: "Slow down a little and try again." }, 429);
  const from = await memberById(s.uid);
  if (!from) return json({ error: "Sign in first." }, 401);
  const b = await req.json().catch(() => ({}));
  const amount = micro(b.amount);
  const r = await webTip({ from, to: String(b.to ?? ""), amount, key: String(b.key ?? "") });
  if ("error" in r) return json({ error: r.error }, 400);
  const o = r.outcome;
  if (o.kind === "rejected") return json({ status: "rejected", error: o.reason }, 422);
  if (o.kind === "duplicate") return json({ status: "duplicate" });
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const text = o.kind === "sent"
    ? `@${r.toHandle} I just sent you ${usd(amount)} on Cheese Pay 🧀 ${base}`
    : `@${r.toHandle} I sent you ${usd(amount)} on Cheese Pay 🧀 Make a wallet within 7 days to claim it: ${base}`;
  return json({ status: o.kind, toHandle: r.toHandle, txHash: o.kind === "sent" ? o.txHash : undefined, shareUrl: `https://x.com/intent/post?text=${encodeURIComponent(text)}` });
}
