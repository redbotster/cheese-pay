import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSession, revokeAllSessions, revokeSession, sessionRow } from "./db.ts";
import { open, seal } from "./crypto.ts";

const DAYS = 7;
const PROD = process.env.NODE_ENV === "production";
/** __Host- makes browsers refuse the cookie unless it is Secure, host-only and path=/. */
const NAME = PROD ? "__Host-cp_session" : "cp_session";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};
export type Session = { uid: string; sid: string };

/** Starts a session for a 1Claw user. Their 1Claw token is sealed (AES-GCM) in our database, never sent to the browser. */
export async function setSession(uid: string, oneclawToken: string) {
  const sid = randomBytes(32).toString("hex");
  const expires = Date.now() + DAYS * 86_400_000;
  let tokenExp: number | null = null;
  try { tokenExp = JSON.parse(Buffer.from(oneclawToken.split(".")[1], "base64url").toString()).exp * 1000; } catch { /* opaque token */ }
  await createSession(sid, uid, expires, seal(oneclawToken), tokenExp);
  const jwt = await new SignJWT({ sid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(expires / 1000)).sign(secret());
  (await cookies()).set(NAME, jwt, { httpOnly: true, secure: PROD, sameSite: "lax", path: "/", maxAge: DAYS * 86400 });
}

async function current() {
  const c = (await cookies()).get(NAME)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret(), { algorithms: ["HS256"] });
    const sid = String(payload.sid ?? "");
    const row = sid ? await sessionRow(sid) : undefined; // revoked or expired on the server = signed out
    return row ? { sid, ...row } : null;
  } catch { return null; }
}

export async function getSession(): Promise<Session | null> {
  const s = await current();
  return s ? { uid: s.uid, sid: s.sid } : null;
}

/** The user's live 1Claw token, or null if it has expired (they sign in again to change wallet settings). */
export async function userToken(): Promise<string | null> {
  const s = await current();
  if (!s?.token_enc || (s.token_exp && s.token_exp < Date.now() + 15_000)) return null;
  return open(s.token_enc);
}

/** Ends this browser's session. With `everywhere`, ends every session this account has. */
export async function clearSession(everywhere = false) {
  const s = await current();
  if (s) await (everywhere ? revokeAllSessions(s.uid) : revokeSession(s.sid));
  (await cookies()).delete(NAME);
}
