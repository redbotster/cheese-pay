import test from "node:test";
import assert from "node:assert/strict";
process.env.CHEESE_DB = ":memory:";
const { upsertUser, setWallet, tipByTweet } = await import("../lib/db.ts");
const { handleTip } = await import("../lib/tip.ts");

test("no wallet: rejected, nothing sent, and the same tweet is a no-op the second time", async () => {
  await upsertUser("1", "alice"); await upsertUser("2", "bob");
  const a = { tweetId: "t1", fromX: "1", toX: "2", toHandle: "bob", amount: 1_000_000n };
  const r1 = await handleTip(a);
  assert.equal(r1.kind, "rejected");
  assert.equal((await tipByTweet("t1"))!.status, "rejected");
  assert.equal((await handleTip(a)).kind, "duplicate");
});
test("self tip rejected even with a wallet record", async () => {
  await upsertUser("3", "carol");
  await setWallet("3", "0x" + "1".repeat(40), JSON.stringify({}));
  const r = await handleTip({ tweetId: "t2", fromX: "3", toX: "3", toHandle: "carol", amount: 500_000n });
  assert.equal(r.kind, "rejected");
});

test("daily limit can never exceed what the user signed onchain", async () => {
  const { limitsOf } = await import("../lib/tip.ts");
  const u = (over: object) => ({ x_id: "9", handle: "z", wallet: "0x1", created_at: 0, max_tip: null, daily_cap: null, paused: 0,
    permission: JSON.stringify({ permission: { allowance: "5000000" } }), ...over }) as never;
  assert.equal(limitsOf(u({ daily_cap: "20000000" })).dailyCap, 5_000_000n); // app setting higher than signed: signed wins
  assert.equal(limitsOf(u({ daily_cap: "2000000" })).dailyCap, 2_000_000n); // lowered: instant
  assert.equal(limitsOf(u({ paused: 1 })).paused, true);
  assert.equal(limitsOf(u({})).maxTip, 1_000_000n); // default
});
