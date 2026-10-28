import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setWallet } from "@/lib/db";
import { CHAIN_ID, DAILY_CAP, PERIOD_SECONDS, USDC } from "@/lib/config";

/** Saves the wallet + signed spend permission the browser got from the passkey wallet.
 *  The body is user-supplied, so every field that matters is checked against our own config. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in with X first." }, { status: 401 });
  const sp = (await req.json())?.permission;
  const p = sp?.permission;
  const spender = process.env.SPENDER_ADDRESS?.toLowerCase();
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
  if (!p || !sp.signature || !spender) return bad("Missing permission.");
  if (String(p.spender).toLowerCase() !== spender) return bad("Wrong spender.");
  if (String(p.token).toLowerCase() !== USDC.toLowerCase()) return bad("Permission must be for USDC.");
  if ((sp.chainId ?? CHAIN_ID) !== CHAIN_ID) return bad("Permission must be on Base.");
  if (Number(p.period) !== PERIOD_SECONDS) return bad("Permission must reset daily.");
  if (BigInt(p.allowance) > DAILY_CAP || BigInt(p.allowance) <= 0n) return bad("Daily limit is above $10.");
  if (Number(p.end) <= Date.now() / 1000) return bad("Permission already expired.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(p.account)) return bad("Bad wallet address.");
  setWallet(s.xId, p.account, JSON.stringify(sp));
  return NextResponse.json({ ok: true, wallet: p.account });
}
