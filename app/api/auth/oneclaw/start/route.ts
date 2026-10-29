import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { allow, clientIp } from "@/lib/security";

/** "Sign in with 1Claw" for people who already have a 1Claw account: OAuth code flow with PKCE on 1Claw's own page. */
export async function GET(req: Request) {
  if (!(await allow(`oclogin:${clientIp(req)}`, 20, 600))) return new NextResponse("Too many attempts. Try again in a few minutes.", { status: 429 });
  const home = process.env.APP_URL ?? new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const hint = new URL(req.url).searchParams.get("email") ?? "";
  const url = new URL("https://1claw.co/oauth/authorize");
  url.search = new URLSearchParams({
    response_type: "code", client_id: process.env.ONECLAW_OAUTH_CLIENT_ID ?? "cheese-pay", redirect_uri: `${home}/api/auth/oneclaw/callback`,
    scope: "openid email wallet", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    ...(/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(hint) ? { login_hint: hint } : {}),
  }).toString();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth/oneclaw", maxAge: 600 };
  res.cookies.set("cp_oc_state", state, opts);
  res.cookies.set("cp_oc_verifier", verifier, opts);
  return res;
}
