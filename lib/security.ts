import { hit } from "./db.ts";

/** CSRF defence for state-changing requests: the browser must say the request came from our own origin. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin) { try { return new URL(origin).host === host; } catch { return false; } }
  return req.headers.get("sec-fetch-site") === "same-origin";
}

export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();

/** True if the caller is still within `max` requests per `windowSec`. */
export async function allow(key: string, max: number, windowSec: number): Promise<boolean> {
  try { return (await hit(key, windowSec)) <= max; }
  catch { return false; } // if we cannot count, fail closed
}
