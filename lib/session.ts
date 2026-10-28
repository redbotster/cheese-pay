import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSession, revokeAllSessions, revokeSession, sessionValid } from "./db.ts";

const DAYS = 7;
const PROD = process.env.NODE_ENV === "production";
/** __Host- makes browsers refuse the cookie unless it is Secure, host-only and path=/. Harder to overwrite from a sibling subdomain. */
const NAME = PROD ? "__Host-cp_session" : "cp_session";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};
export type Session = { xId: string; handle: string; sid: string };

export async function setSession(s: { xId: string; handle: string }) {
  const sid = randomBytes(32).toString("hex");
  const expires = Date.now() + DAYS * 86_400_000;
  await createSession(sid, s.xId, expires); // server-side record, so logout and "log out everywhere" really work
  const jwt = await new SignJWT({ x: s.xId, h: s.handle, sid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(expires / 1000)).sign(secret());
  (await cookies()).set(NAME, jwt, { httpOnly: true, secure: PROD, sameSite: "lax", path: "/", maxAge: DAYS * 86400 });
}

export async function getSession(): Promise<Session | null> {
  const c = (await cookies()).get(NAME)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret(), { algorithms: ["HS256"] });
    const sid = String(payload.sid ?? "");
    if (!sid || !(await sessionValid(sid))) return null; // revoked or expired on the server
    return { xId: String(payload.x), handle: String(payload.h), sid };
  } catch { return null; }
}

/** Ends this browser's session. With `everywhere`, ends every session this account has. */
export async function clearSession(everywhere = false) {
  const s = await getSession();
  if (s) await (everywhere ? revokeAllSessions(s.xId) : revokeSession(s.sid));
  (await cookies()).delete(NAME);
}
