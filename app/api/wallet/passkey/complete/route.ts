import { fail, guard, json } from "@/lib/api";
import { walletCtx } from "@/lib/wallet-api";
import { passkeyRegisterComplete } from "@/lib/oneclaw";

export async function POST(req: Request) {
  const no = await guard(req, "pk", 10, 60); if (no) return no;
  const c = await walletCtx(); if ("error" in c) return c.error;
  const b = await req.json().catch(() => ({}));
  const body = { credential_id: String(b.credential_id ?? ""), attestation_object: String(b.attestation_object ?? ""), client_data_json: String(b.client_data_json ?? ""),
    transports: Array.isArray(b.transports) ? b.transports.map(String).slice(0, 6) : undefined, name: "Cheese Pay" };
  if (!body.credential_id || !body.attestation_object || !body.client_data_json) return json({ error: "Passkey setup was incomplete." }, 400);
  try { await passkeyRegisterComplete(c.token, body); return json({ ok: true }); } catch (e) { return fail(e); }
}
