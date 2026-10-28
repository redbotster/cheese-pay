import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { allow, clientIp } from "@/lib/security";

export async function GET(req: Request) {
  if (!(await allow(`login:${clientIp(req)}`, 20, 60))) return new NextResponse("Too many attempts. Try again in a minute.", { status: 429 });
  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.search = new URLSearchParams({
    response_type: "code", client_id: process.env.X_CLIENT_ID!, redirect_uri: process.env.X_REDIRECT_URI!,
    scope: "users.read tweet.read", state, code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("cp_state", state, opts);
  res.cookies.set("cp_verifier", verifier, opts);
  return res;
}
