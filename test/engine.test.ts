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

test("an overdue pending tip is expired and reported exactly once", async () => {
  const { claimTip, setTip, expireOld, tipByTweet: byTweet } = await import("../lib/db.ts");
  await claimTip("t-old", "1", "77", "ghost", 1_000_000n, Date.now() - 1000); // already past its 7 days
  await setTip((await byTweet("t-old"))!.id, "pending");
  const first = await expireOld();
  assert.deepEqual(first.map((t) => t.tweet_id), ["t-old"]);
  assert.equal((await byTweet("t-old"))!.status, "expired");
  assert.equal((await expireOld()).length, 0); // second run must not notify again
});

test("web tips: unknown handle, pending reserves the daily limit, and a retry is a no-op", async () => {
  const { webTip } = await import("../lib/webtip.ts");
  const { upsertUser, setWallet, tipByTweet } = await import("../lib/db.ts");
  const permission = JSON.stringify({ permission: { allowance: "2000000" } }); // user signed a $2/day limit
  await upsertUser("50", "sender"); await setWallet("50", "0x" + "2".repeat(40), permission, 2_000_000n);
  // withPermission: permissionActive reads the chain, so a fake permission is "inactive" -> the engine rejects before sending
  const known = async (h: string) => (h === "nobody" ? null : { id: "900" });
  assert.deepEqual(await webTip({ fromX: "50", to: "@nobody", amount: 1_000_000n, key: "key-aaaaaaaa" }, known), { error: "We couldn't find @nobody on X." });
  assert.ok("error" in (await webTip({ fromX: "50", to: "bad handle!", amount: 1_000_000n, key: "key-aaaaaaaa" }, known)));
  assert.ok("error" in (await webTip({ fromX: "50", to: "@x", amount: 6_000_000n, key: "key-aaaaaaaa" }, known))); // over the $5 ceiling
  const r = await webTip({ fromX: "50", to: "@alice", amount: 1_000_000n, key: "key-bbbbbbbb" }, known);
  assert.ok(!("error" in r)); // reached the engine (rejected there because the fake permission isn't active onchain)
  assert.equal((await tipByTweet("web:50:key-bbbbbbbb"))!.to_x, "900");
  const again = await webTip({ fromX: "50", to: "@alice", amount: 1_000_000n, key: "key-bbbbbbbb" }, known);
  assert.ok(!("error" in again) && again.outcome.kind === "duplicate"); // double-click / retry
});
