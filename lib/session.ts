import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};
export type Session = { xId: string; handle: string };

export async function setSession(s: Session) {
  const jwt = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("14d").sign(secret());
  (await cookies()).set("cp_session", jwt, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 14 * 86400 });
}
export async function getSession(): Promise<Session | null> {
  const c = (await cookies()).get("cp_session")?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    return { xId: String(payload.xId), handle: String(payload.handle) };
  } catch { return null; }
}
export async function clearSession() { (await cookies()).delete("cp_session"); }
