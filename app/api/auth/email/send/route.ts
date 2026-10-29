import { guard, json } from "@/lib/api";
import { allow } from "@/lib/security";
import { sendOtp } from "@/lib/oneclaw";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export async function POST(req: Request) {
  const no = await guard(req, "otp", 10, 600); if (no) return no;
  const email = String((await req.json().catch(() => ({}))).email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ error: "Enter a valid email address." }, 400);
  // codeStep keeps the code box on screen: the last code we sent is still good for 5 minutes
  if (!(await allow(`otp-email:${email}`, 5, 600))) return json({ codeStep: true, error: "We already sent you a code. Use the newest one in your inbox, or get a new one in a few minutes." }, 429);
  try { await sendOtp(email); } catch (e) { console.error("otp send", e); }
  return json({ ok: true }); // same answer either way, so this can't be used to test which emails have accounts
}
