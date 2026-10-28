import { fail, guard, json } from "@/lib/api";
import { savePending, signable, walletCtx } from "@/lib/wallet-api";
import { prepareRevoke } from "@/lib/oneclaw";

/** Prepares removing the Cheese Pay agent from the Safe entirely. Signed with the user's passkey. */
export async function POST(req: Request) {
  const no = await guard(req, "grant", 6, 60); if (no) return no;
  const c = await walletCtx(); if ("error" in c) return c.error;
  if (!c.member?.safe_id || !c.member.grant_id) return json({ error: "There is no active limit to remove." }, 400);
  try {
    const r = await prepareRevoke(c.token, c.member.safe_id, c.member.grant_id);
    await savePending(c.s.sid, { kind: "revoke", safeId: c.member.safe_id, prepare: { ...r.prepare, grant_id: r.prepare.grant_id ?? c.member.grant_id } });
    return json(signable(r.prepare));
  } catch (e) { return fail(e); }
}
