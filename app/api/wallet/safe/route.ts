import { after } from "next/server";
import { fail, guard, json } from "@/lib/api";
import { walletCtx } from "@/lib/wallet-api";
import { createSafe, listPasskeys, listSafes } from "@/lib/oneclaw";
import { setSafe } from "@/lib/db";
import { releaseEscrow } from "@/lib/tip";

export const maxDuration = 60;

/** Creates (or finds) the member's passkey-owned Safe on Base. */
export async function POST(req: Request) {
  const no = await guard(req, "safe", 6, 60); if (no) return no;
  const c = await walletCtx(); if ("error" in c) return c.error;
  try {
    let safe = (await listSafes(c.token)).find((x) => x.chain === "base");
    if (!safe) {
      const pk = (await listPasskeys(c.token)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!pk) return json({ error: "Create your passkey first." }, 400);
      safe = await createSafe(c.token, pk.id);
    }
    await setSafe(c.s.uid, safe.id, safe.safe_address);
    if (c.member?.x_id) after(() => releaseEscrow(c.member.x_id!));
    return json({ ok: true, safe_address: safe.safe_address });
  } catch (e) { return fail(e); }
}
