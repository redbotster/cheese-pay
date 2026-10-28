import { fail, guard, json } from "@/lib/api";
import { walletCtx } from "@/lib/wallet-api";
import { passkeyRegisterBegin } from "@/lib/oneclaw";

export async function POST(req: Request) {
  const no = await guard(req, "pk", 10, 60); if (no) return no;
  const c = await walletCtx(); if ("error" in c) return c.error;
  try { return json(await passkeyRegisterBegin(c.token)); } catch (e) { return fail(e); }
}
