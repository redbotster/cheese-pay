// Reads @1clawAI mentions, turns "tip @alice $1" requests into tips, replies with the result.
//   node --experimental-strip-types scripts/watcher.ts          # loop (every 60s)
//   DRY=1 node --experimental-strip-types scripts/watcher.ts    # parse + print only: no tips, no posts
import { execFileSync } from "node:child_process";
import { parseTip } from "../lib/parse.ts";
import { BOT_HANDLE } from "../lib/config.ts";
import { handleTip, releasePending } from "../lib/tip.ts";
import { expireOld, kvGet, kvSet, markSeen, pendingRecipients, shouldNudge } from "../lib/db.ts";
import { usd } from "../lib/limits.ts";

const DRY = process.env.DRY === "1";
const SITE = "https://1claw.co/for-ai";
const MAX_NUDGES_PER_RUN = 5; // cold @mentions are rate-limited on purpose

const log = (m: string) => console.log(`[${new Date().toISOString()}] [cheese-pay] ${m}`);
const clean = (s: string) => s.replace(/[—–]/g, ",").replace(/!/g, ".");
const xurl = (...a: string[]) => { if (DRY) return log(`DRY xurl ${a.join(" ")}`); try { execFileSync("xurl", a, { stdio: "pipe", timeout: 30000 }); } catch (e) { log(`xurl failed: ${(e as Error).message.slice(0, 120)}`); } };
const reply = (id: string, t: string) => xurl("reply", id, clean(t));
const post = (t: string) => xurl("post", clean(t));

type Tw = { id: string; text: string; author?: { id: string; userName: string }; entities?: { user_mentions?: { id_str: string; screen_name: string }[] } };

/** Official X API via xurl (OAuth already set up for @1clawAI). since_id keeps reads to new mentions only. */
let botId = "";
function xread(path: string): any { return JSON.parse(execFileSync("xurl", [path], { encoding: "utf8", timeout: 30000 })); }
async function fetchMentions(): Promise<Tw[]> {
  botId ||= xread("/2/users/me").data.id;
  const since = await kvGet("since_id");
  const r = xread(`/2/users/${botId}/mentions?max_results=100&expansions=author_id&tweet.fields=author_id,entities` + (since ? `&since_id=${since}` : ""));
  const users = new Map<string, string>((r.includes?.users ?? []).map((u: any) => [u.id, u.username]));
  if (r.meta?.newest_id && !DRY) await kvSet("since_id", r.meta.newest_id); // only advance when we will actually process
  return (r.data ?? []).map((t: any) => ({
    id: t.id, text: t.text, author: { id: t.author_id, userName: users.get(t.author_id) ?? "" },
    entities: { user_mentions: (t.entities?.mentions ?? []).map((m: any) => ({ id_str: m.id, screen_name: m.username })) },
  }));
}

async function tick() {
  await expireOld();
  const mentions = await fetchMentions();
  let nudges = 0;
  for (const t of mentions.reverse()) { // API returns newest first; process oldest first
    if (!t.author) continue;
    const parsed = parseTip(t.text, BOT_HANDLE);
    if (!parsed) continue;
    if (DRY) { log(`DRY ${t.id} @${t.author.userName}: ${JSON.stringify(parsed, (_, v) => typeof v === "bigint" ? v.toString() : v)}`); continue; }
    if (!(await markSeen(t.id))) continue;
    if ("error" in parsed) { reply(t.id, `${parsed.error} Try: @${BOT_HANDLE} tip @friend $1`); continue; }
    const target = t.entities?.user_mentions?.find((m) => m.screen_name.toLowerCase() === parsed.toHandle.toLowerCase());
    if (!target) { reply(t.id, "I couldn't tell who to tip. Tag them like @name."); continue; }
    const out = await handleTip({ tweetId: t.id, fromX: t.author.id, toX: target.id_str, toHandle: target.screen_name, amount: parsed.amount });
    log(`${t.id} ${t.author.userName} -> ${target.screen_name} ${usd(parsed.amount)}: ${out.kind}`);
    if (out.kind === "sent") reply(t.id, `Sent ${usd(parsed.amount)} to @${target.screen_name} 🧀 https://basescan.org/tx/${out.txHash}`);
    else if (out.kind === "rejected") reply(t.id, out.reason);
    else if (out.kind === "pending") {
      reply(t.id, `@${target.screen_name} doesn't have a Cheese Pay wallet yet, so your ${usd(parsed.amount)} is on hold for 7 days. Nothing is charged until they join.`);
      if (nudges < MAX_NUDGES_PER_RUN && await shouldNudge(target.screen_name))
        { nudges++; post(`Heads up @${target.screen_name}, someone wants to tip you ${usd(parsed.amount)} on X 🧀 Set up a free Cheese Pay wallet with Face ID or a fingerprint, no seed phrase, to claim it: ${SITE}`); }
    }
  }
  if (DRY) return;
  for (const toX of await pendingRecipients()) { // anyone who has since created a wallet gets paid
    for (const { tip, outcome } of await releasePending(toX)) {
      log(`released tip ${tip.id}: ${outcome.kind}`);
      if (outcome.kind === "sent") reply(tip.tweet_id, `@${tip.to_handle} just set up Cheese Pay, so your ${usd(BigInt(tip.amount))} tip landed 🧀 https://basescan.org/tx/${outcome.txHash}`);
    }
  }
}

(async () => {
  for (;;) {
    try { await tick(); } catch (e) { log(`tick failed: ${(e as Error).message}`); }
    if (process.env.ONCE === "1") break;
    await new Promise((r) => setTimeout(r, 60_000));
  }
})();
