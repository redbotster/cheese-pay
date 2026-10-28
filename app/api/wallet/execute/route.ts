import { fail, guard, json } from "@/lib/api";
import { takePending, walletCtx } from "@/lib/wallet-api";
import { executeSafeTx } from "@/lib/oneclaw";
import { setGrant } from "@/lib/db";

export const maxDuration = 60;

/** Relays the transaction the user just signed with their passkey. Only the signature comes from the browser. */
export async function POST(req: Request) {
  const no = await guard(req, "exec", 6, 60); if (no) return no;
  const c = await walletCtx(); if ("error" in c) return c.error;
  const p = await takePending(c.s.sid);
  if (!p) return json({ error: "That request expired. Start again." }, 400);
  const b = await req.json().catch(() => ({}));
  const assertion = { credential_id: String(b.credential_id ?? ""), authenticator_data: String(b.authenticator_data ?? ""), client_data_json: String(b.client_data_json ?? ""), signature: String(b.signature ?? "") };
  if (Object.values(assertion).some((v) => !v)) return json({ error: "The passkey signature was incomplete." }, 400);
  try {
    const r = await executeSafeTx(c.token, p.safeId, p.prepare, assertion);
    if (p.kind === "grant") await setGrant(c.s.uid, p.prepare.grant_id ?? null, BigInt(p.amount!), "active");
    else await setGrant(c.s.uid, null, null, null);
    return json({ ok: true, tx: r.tx_hash ?? null });
  } catch (e) { return fail(e); }
}
