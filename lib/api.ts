import { NextResponse } from "next/server";
import { allow, clientIp, sameOrigin } from "./security.ts";
import { OneclawError } from "./oneclaw.ts";

export const json = (d: unknown, status = 200) => NextResponse.json(d, { status });

/** Every state-changing route: same-origin only, then rate-limited. Returns a response to send back if the request is refused. */
export async function guard(req: Request, key: string, max: number, windowSec: number): Promise<NextResponse | null> {
  if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
  if (!(await allow(`${key}:${clientIp(req)}`, max, windowSec))) return json({ error: "Slow down a little and try again." }, 429);
  return null;
}

/** Never leak upstream details to the browser; log them server-side. */
export function fail(e: unknown, fallback = "Something went wrong. Nothing was charged.") {
  console.error("api error", e);
  if (e instanceof OneclawError) {
    if (e.status === 401) return json({ error: "Your 1Claw session expired. Sign in again.", relogin: true }, 401);
    if (e.status === 400 || e.status === 409 || e.status === 422) return json({ error: e.message.slice(0, 200) }, e.status);
  }
  return json({ error: fallback }, 502);
}
