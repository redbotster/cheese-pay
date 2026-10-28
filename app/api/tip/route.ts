import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { webTip } from "@/lib/webtip";
import { usd } from "@/lib/limits";
import { allow, sameOrigin } from "@/lib/security";

export const maxDuration = 60; // an onchain send waits for confirmations

const micro = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? BigInt(Math.round(n * 100)) * 10_000n : 0n; // whole cents only
};

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  if (!(await allow(`tip:${s.xId}`, 12, 60)) || !(await allow(`tipday:${s.xId}`, 300, 86400)))
    return NextResponse.json({ error: "Slow down a little and try again." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const amount = micro(b.amount);
  const r = await webTip({ fromX: s.xId, to: String(b.to ?? ""), amount, key: String(b.key ?? "") });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const o = r.outcome;
  if (o.kind === "rejected") return NextResponse.json({ status: "rejected", error: o.reason }, { status: 422 });
  if (o.kind === "duplicate") return NextResponse.json({ status: "duplicate" });
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const text = o.kind === "sent"
    ? `@${r.toHandle} I just sent you ${usd(amount)} on Cheese Pay 🧀 ${base}`
    : `@${r.toHandle} I'm sending you ${usd(amount)} on Cheese Pay 🧀 Sign in with X to claim it: ${base}`;
  return NextResponse.json({ status: o.kind, toHandle: r.toHandle, txHash: o.kind === "sent" ? o.txHash : undefined, shareUrl: `https://x.com/intent/post?text=${encodeURIComponent(text)}` });
}
