import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { upsertUser } from "@/lib/db";

export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const state = u.searchParams.get("state"), code = u.searchParams.get("code");
  const verifier = req.cookies.get("cp_verifier")?.value;
  if (!code || !state || state !== req.cookies.get("cp_state")?.value || !verifier) return new NextResponse("Login expired. Try again.", { status: 400 });
  const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
  const tok = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.X_REDIRECT_URI!, code_verifier: verifier, client_id: process.env.X_CLIENT_ID! }),
  });
  if (!tok.ok) return new NextResponse("X login failed.", { status: 502 });
  const { access_token } = await tok.json();
  const me = await fetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) return new NextResponse("Could not read your X profile.", { status: 502 });
  const { data } = await me.json(); // we keep only id + handle; the access token is never stored
  upsertUser(data.id, data.username);
  await setSession({ xId: data.id, handle: data.username.toLowerCase() });
  const res = NextResponse.redirect(new URL("/for-ai/setup", process.env.X_REDIRECT_URI!));
  res.cookies.delete("cp_state"); res.cookies.delete("cp_verifier");
  return res;
}
