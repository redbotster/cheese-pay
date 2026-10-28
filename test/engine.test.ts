import test from "node:test";
import assert from "node:assert/strict";
process.env.CHEESE_DB = ":memory:";
const { upsertUser, setWallet, tipByTweet } = await import("../lib/db.ts");
const { handleTip } = await import("../lib/tip.ts");

test("no wallet: rejected, nothing sent, and the same tweet is a no-op the second time", async () => {
  upsertUser("1", "alice"); upsertUser("2", "bob");
  const a = { tweetId: "t1", fromX: "1", toX: "2", toHandle: "bob", amount: 1_000_000n };
  const r1 = await handleTip(a);
  assert.equal(r1.kind, "rejected");
  assert.equal(tipByTweet("t1")!.status, "rejected");
  assert.equal((await handleTip(a)).kind, "duplicate");
});
test("self tip rejected even with a wallet record", async () => {
  upsertUser("3", "carol");
  setWallet("3", "0x" + "1".repeat(40), JSON.stringify({}));
  const r = await handleTip({ tweetId: "t2", fromX: "3", toX: "3", toHandle: "carol", amount: 500_000n });
  assert.equal(r.kind, "rejected");
});
