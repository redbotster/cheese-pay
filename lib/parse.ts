import { MAX_TIP } from "./config.ts";

export type ParsedTip = { toHandle: string; amount: bigint } | { error: string };

/** "@1clawAI tip @alice $1" or "@1clawAI tip @alice 0.50". Exactly one recipient, one amount. */
export function parseTip(text: string, botHandle: string): ParsedTip | null {
  const t = text.replace(/\s+/g, " ").trim();
  const bot = new RegExp(`@${botHandle}\\b`, "i");
  if (!bot.test(t) || !/\btip\b/i.test(t)) return null; // not a tip request, ignore silently
  const handles = [...t.matchAll(/@(\w{1,15})/g)].map((m) => m[1]).filter((h) => h.toLowerCase() !== botHandle.toLowerCase());
  const unique = [...new Set(handles.map((h) => h.toLowerCase()))];
  if (unique.length !== 1) return { error: "Tag exactly one person to tip." };
  const m = t.match(/\$\s?(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s?(?:usdc|usd|dollars?)\b|\btip\s+@\w+\s+(\d+(?:\.\d{1,2})?)\b/i);
  const raw = m && (m[1] ?? m[2] ?? m[3]);
  if (!raw) return { error: "Add an amount, like $1." };
  const [whole, frac = ""] = raw.split(".");
  const amount = BigInt(whole) * 1_000_000n + BigInt((frac + "00").slice(0, 2)) * 10_000n;
  if (amount <= 0n) return { error: "Amount must be more than $0." };
  if (amount > MAX_TIP) return { error: "Tips are capped at $1 each." };
  return { toHandle: handles.find((h) => h.toLowerCase() === unique[0])!, amount };
}
