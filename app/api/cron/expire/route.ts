import { timingSafeEqual } from "node:crypto";
import { json } from "@/lib/api";
import { refundExpired } from "@/lib/tip";
import { pruneSessions } from "@/lib/db";

export const maxDuration = 60;

/** Daily (vercel.json): refunds tips nobody claimed in 7 days. Requires the CRON_SECRET bearer Vercel sends. */
export async function GET(req: Request) {
  const want = `Bearer ${process.env.CRON_SECRET ?? ""}`, got = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return json({ error: "Forbidden" }, 403);
  const refunded = await refundExpired();
  await pruneSessions();
  return json({ ok: true, refunded });
}
