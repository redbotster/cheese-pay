import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { allow, clientIp } from "@/lib/security";
import { oauthToken, whoAmI } from "@/lib/oneclaw";
import { upsertMember } from "@/lib/db";
import { setSession } from "@/lib/session";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: NextRequest) {
  const home = process.env.APP_URL ?? new URL(req.url).origin;
  const done = (result: string) => {
    const res = NextResponse.redirect(new URL(`/approved?result=${result}`, home));
    res.cookies.delete({ name: "cp_oc_state", path: "/api/auth/oneclaw" }); res.cookies.delete({ name: "cp_oc_verifier", path: "/api/auth/oneclaw" });
    return res;
  };
  if (!(await allow(`occb:${clientIp(req)}`, 20, 600))) return done("busy");
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return done("denied");
  const state = q.get("state") ?? "", code = q.get("code");
  const expected = req.cookies.get("cp_oc_state")?.value ?? "", verifier = req.cookies.get("cp_oc_verifier")?.value;
  if (!code || !expected || !same(state, expected) || !verifier) return done("expired");
  try {
    const t = await oauthToken(code, `${home}/api/auth/oneclaw/callback`, verifier);
    const me = await whoAmI(t.access_token);
    if (!me.id) return done("failed");
    await upsertMember(me.id, me.email ?? "");
    await setSession(me.id, t.access_token);
    return done("signedin");
  } catch (e) {
    console.error("1claw oauth", e instanceof Error ? e.message : "error");
    return done("failed");
  }
}
