import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { sameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const everywhere = (await req.json().catch(() => ({}))).everywhere === true;
  await clearSession(everywhere);
  return NextResponse.json({ ok: true });
}
