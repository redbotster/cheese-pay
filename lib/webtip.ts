import { CEIL_MAX_TIP } from "./config.ts";
import { cacheHandle, cachedHandle, type Member } from "./db.ts";
import { sendTip, type Outcome, type Spend } from "./tip.ts";

const HANDLE = /^\w{1,15}$/;
const CACHE_MS = 30 * 86_400_000;

export type Resolver = (handle: string) => Promise<{ id: string } | null>;

/** @handle -> X user ID. Cached for 30 days; one paid X lookup (about $0.01) the first time a handle is tipped. */
export const resolveHandle: Resolver = async (handle) => {
  const hit = await cachedHandle(handle);
  if (hit && Date.now() - Number(hit.at) < CACHE_MS) return { id: hit.x_id };
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X lookup is not configured");
  const r = await fetch(`https://api.x.com/2/users/by/username/${handle}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`X lookup failed (${r.status})`);
  const id = (await r.json()).data?.id;
  if (!id) return null;
  await cacheHandle(handle, id);
  return { id };
};

export type WebTipResult = { outcome: Outcome; toHandle: string; toX: string } | { error: string };

/** A tip sent from the website. `key` is generated per click by the browser, so a double-click or retry is a no-op. */
export async function webTip(a: { from: Member; to: string; amount: bigint; key: string }, resolve: Resolver = resolveHandle, spend?: Spend): Promise<WebTipResult> {
  const to = a.to.replace(/^@/, "").trim();
  if (!a.from.x_id) return { error: "Link your X account first." };
  if (!HANDLE.test(to)) return { error: "Enter a valid X handle, like @alice." };
  if (!/^[\w-]{8,64}$/.test(a.key)) return { error: "Bad request." };
  if (a.amount <= 0n || a.amount > CEIL_MAX_TIP) return { error: "Choose an amount between $0.01 and $5." };
  let target: { id: string } | null;
  try { target = await resolve(to); } catch { return { error: "Couldn't look up that X account right now. Try again in a minute." }; }
  if (!target) return { error: `We couldn't find @${to} on X.` };
  const outcome = await sendTip({ from: a.from, toX: target.id, toHandle: to, amount: a.amount, key: a.key }, spend);
  return { outcome, toHandle: to, toX: target.id };
}
