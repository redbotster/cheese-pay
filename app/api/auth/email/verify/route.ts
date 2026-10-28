import { guard, json } from "@/lib/api";
import { allow } from "@/lib/security";
import { verifyOtp } from "@/lib/oneclaw";
import { upsertMember } from "@/lib/db";
import { setSession } from "@/lib/session";

export async function POST(req: Request) {
  const no = await guard(req, "otp-verify", 20, 600); if (no) return no;
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase(), code = String(b.code ?? "").trim();
  if (!/^\d{6}$/.test(code) || !email) return json({ error: "Enter the 6-digit code from your email." }, 400);
  if (!(await allow(`otp-try:${email}`, 6, 600))) return json({ error: "Too many tries. Request a new code in a few minutes." }, 429);
  try {
    const r = await verifyOtp(email, code);
    if (r.__status === 409 && r.link_required?.authorize_url) // already has a 1Claw account in another org: they approve the link on 1Claw
      return json({ link: r.link_required.authorize_url, error: "You already have a 1Claw account. Approve Cheese Pay on 1Claw, then sign in again." }, 409);
    if (r.mfa_required) return json({ error: "Your 1Claw account uses two-factor sign-in, which Cheese Pay doesn't support yet." }, 400);
    if (!r.token || !r.user_id) return json({ error: "That code didn't work. Check it and try again." }, 401);
    await upsertMember(r.user_id, r.email ?? email);
    await setSession(r.user_id, r.token);
    return json({ ok: true });
  } catch { return json({ error: "That code didn't work. Check it and try again." }, 401); }
}
