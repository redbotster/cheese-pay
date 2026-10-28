import { after, NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { allow, clientIp } from "@/lib/security";
import { getSession } from "@/lib/session";
import { linkX, memberById } from "@/lib/db";
import { releaseEscrow } from "@/lib/tip";

export const maxDuration = 60;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: NextRequest) {
  if (!(await allow(`cb:${clientIp(req)}`, 20, 60))) return new NextResponse("Too many attempts. Try again in a minute.", { status: 429 });
  const s = await getSession();
  const home = process.env.APP_URL ?? new URL(req.url).origin;
  if (!s) return NextResponse.redirect(new URL("/login", home));
  const state = req.nextUrl.searchParams.get("state") ?? "", code = req.nextUrl.searchParams.get("code");
  const expected = req.cookies.get("cp_state")?.value ?? "", verifier = req.cookies.get("cp_verifier")?.value;
  if (!code || !expected || !same(state, expected) || !verifier) return new NextResponse("Linking expired. Try again.", { status: 400 });
  const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
  const tok = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.X_REDIRECT_URI!, code_verifier: verifier, client_id: process.env.X_CLIENT_ID! }),
  });
  if (!tok.ok) return new NextResponse("X sign-in failed.", { status: 502 });
  const { access_token } = await tok.json();
  const me = await fetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) return new NextResponse("Could not read your X profile.", { status: 502 });
  const { data } = await me.json(); // keep only id + handle; the X token is discarded
  if (!(await linkX(s.uid, data.id, data.username))) return new NextResponse("That X account is already linked to another Cheese Pay wallet.", { status: 409 });
  if ((await memberById(s.uid))?.safe_address) after(() => releaseEscrow(data.id)); // tips that were waiting for them
  const res = NextResponse.redirect(new URL("/setup", home));
  res.cookies.delete("cp_state"); res.cookies.delete("cp_verifier");
  return res;
}
