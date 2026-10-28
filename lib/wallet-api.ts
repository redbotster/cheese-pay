import { getSession, userToken } from "./session.ts";
import { kvGet, kvSet, memberById, type Member } from "./db.ts";
import type { Prepare } from "./oneclaw.ts";
import { json } from "./api.ts";

/** Wallet routes need a session AND a live 1Claw token (wallet changes are signed as the user, never as us). */
export async function walletCtx() {
  const s = await getSession();
  if (!s) return { error: json({ error: "Sign in first." }, 401) } as const;
  const token = await userToken();
  if (!token) return { error: json({ error: "Your 1Claw session expired. Sign in again.", relogin: true }, 401) } as const;
  return { s, token, member: (await memberById(s.uid)) as Member } as const;
}

/** A transaction waiting for the user's passkey. Kept server-side so the browser can only supply the signature, not change what is signed. */
export type Pending = { kind: "grant" | "revoke"; safeId: string; prepare: Prepare; amount?: string; exp: number };
export const savePending = (sid: string, p: Omit<Pending, "exp">) => kvSet(`prep:${sid}`, JSON.stringify({ ...p, exp: Date.now() + 5 * 60_000 }));
export async function takePending(sid: string): Promise<Pending | null> {
  const raw = await kvGet(`prep:${sid}`);
  if (!raw) return null;
  await kvSet(`prep:${sid}`, "{}"); // single use
  const p = JSON.parse(raw) as Pending;
  return p.exp && p.exp > Date.now() ? p : null;
}

export const signable = (p: Prepare) => ({ challenge: p.safe_tx_hash, credentialId: p.credential_id, transports: p.transports ?? undefined, rpId: p.rp_id });
