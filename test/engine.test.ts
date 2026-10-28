import test from "node:test";
import assert from "node:assert/strict";
process.env.CHEESE_DB = ":memory:";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
process.env.SPENDER_ADDRESS = "0x00000000000000000000000000000000000e5c00";
const db = await import("../lib/db.ts");
const { sendTip, releaseEscrow, refundExpired, limitsOf } = await import("../lib/tip.ts");
const { webTip } = await import("../lib/webtip.ts");

// A fake 1Claw that records every money movement instead of touching the chain.
const moves: string[] = [];
const spend = {
  fromSafe: async (safe: string, to: string, amt: bigint) => { moves.push(`safe:${safe}->${to}:${amt}`); return "0xtx" + moves.length; },
  fromEscrow: async (to: string, amt: bigint) => { moves.push(`escrow->${to}:${amt}`); return "0xesc" + moves.length; },
};
const failing = { fromSafe: async () => { throw new Error("upstream down"); }, fromEscrow: async () => { throw new Error("upstream down"); } };

async function member(uid: string, x: string, opts: { safe?: boolean; grant?: bigint } = {}) {
  await db.upsertMember(uid, `${uid}@example.com`);
  await db.linkX(uid, x, uid);
  if (opts.safe !== false) await db.setSafe(uid, `safe-${uid}`, `0x${uid.padStart(40, "0")}`);
  if (opts.grant) await db.setGrant(uid, `g-${uid}`, opts.grant, "active");
  return (await db.memberById(uid))!;
}

test("direct tip goes from the sender's Safe to the recipient's Safe; retry is a no-op", async () => {
  const a = await member("a1", "x-a1", { grant: 10_000_000n }); await member("b1", "x-b1");
  const r = await sendTip({ from: a, toX: "x-b1", toHandle: "b1", amount: 1_000_000n, key: "k-direct-1" }, spend);
  assert.equal(r.kind, "sent");
  assert.ok(moves.includes(`safe:safe-a1->0x${"b1".padStart(40, "0")}:1000000`));
  assert.equal((await sendTip({ from: a, toX: "x-b1", toHandle: "b1", amount: 1_000_000n, key: "k-direct-1" }, spend)).kind, "duplicate");
});

test("no grant, paused, over limit and self-tip are refused before any money moves", async () => {
  const before = moves.length;
  const nogrant = await member("c1", "x-c1");
  assert.equal((await sendTip({ from: nogrant, toX: "x-b1", toHandle: "b1", amount: 500_000n, key: "k-nogrant" }, spend)).kind, "rejected");
  const p = await member("d1", "x-d1", { grant: 10_000_000n });
  await db.setLimits("d1", 1_000_000n, 10_000_000n, true);
  assert.equal((await sendTip({ from: (await db.memberById("d1"))!, toX: "x-b1", toHandle: "b1", amount: 500_000n, key: "k-paused" }, spend)).kind, "rejected");
  assert.equal((await sendTip({ from: p, toX: "x-b1", toHandle: "b1", amount: 2_000_000n, key: "k-over" }, spend)).kind, "rejected"); // over $1 default
  assert.equal((await sendTip({ from: p, toX: "x-d1", toHandle: "d1", amount: 500_000n, key: "k-self" }, spend)).kind, "rejected");
  assert.equal(moves.length, before);
});

test("daily limit is the smaller of the user's setting and the onchain grant", async () => {
  const e = await member("e1", "x-e1", { grant: 2_000_000n });
  await db.setLimits("e1", 1_000_000n, 20_000_000n, false); // asks for $20/day but only granted $2 onchain
  const m = (await db.memberById("e1"))!;
  assert.equal(limitsOf(m).dailyCap, 2_000_000n);
  assert.equal((await sendTip({ from: m, toX: "x-b1", toHandle: "b1", amount: 1_000_000n, key: "k-e-1" }, spend)).kind, "sent");
  assert.equal((await sendTip({ from: m, toX: "x-b1", toHandle: "b1", amount: 1_000_000n, key: "k-e-2" }, spend)).kind, "sent");
  assert.equal((await sendTip({ from: m, toX: "x-b1", toHandle: "b1", amount: 1_000_000n, key: "k-e-3" }, spend)).kind, "rejected"); // $3 > $2
});

test("tip to someone without a wallet goes to escrow, is paid out when they join, and counts toward the limit", async () => {
  const f = await member("f1", "x-f1", { grant: 10_000_000n });
  const r = await sendTip({ from: f, toX: "x-new", toHandle: "newbie", amount: 1_000_000n, key: "k-escrow-1" }, spend);
  assert.equal(r.kind, "pending");
  assert.ok(moves.at(-1)!.startsWith(`safe:safe-f1->${process.env.SPENDER_ADDRESS}`));
  assert.equal(await db.sentLast24h("x-f1"), 1_000_000n);
  await member("n1", "x-new"); // recipient joins and makes a wallet
  const out = await releaseEscrow("x-new", spend);
  assert.equal(out.length, 1); assert.equal(out[0].ok, true);
  assert.equal((await db.tipByTweet("web:f1:k-escrow-1"))!.status, "sent");
  assert.equal((await releaseEscrow("x-new", spend)).length, 0); // never paid twice
});

test("unclaimed escrow is refunded to the sender exactly once; failures stay pending for retry", async () => {
  const g = await member("g1", "x-g1", { grant: 10_000_000n });
  await sendTip({ from: g, toX: "x-ghost", toHandle: "ghost", amount: 700_000n, key: "k-ghost" }, spend);
  const t = (await db.tipByTweet("web:g1:k-ghost"))!;
  await db.forceExpire(t.id); // its 7 days are up
  assert.equal(await refundExpired(failing), 0);
  assert.equal((await db.tipByTweet("web:g1:k-ghost"))!.status, "pending"); // will retry
  assert.equal(await refundExpired(spend), 1);
  assert.equal((await db.tipByTweet("web:g1:k-ghost"))!.status, "refunded");
  assert.ok(moves.at(-1)!.startsWith(`escrow->0x${"g1".padStart(40, "0")}`));
  assert.equal(await refundExpired(spend), 0);
});

test("a failed send is recorded as failed and nothing is marked sent", async () => {
  const h = await member("h1", "x-h1", { grant: 10_000_000n });
  const r = await sendTip({ from: h, toX: "x-b1", toHandle: "b1", amount: 500_000n, key: "k-fail" }, failing);
  assert.equal(r.kind, "rejected");
  assert.equal((await db.tipByTweet("web:h1:k-fail"))!.status, "failed");
});

test("web tips: X must be linked, handles validated, unknown users reported", async () => {
  await db.upsertMember("i1", "i1@example.com");
  const noX = (await db.memberById("i1"))!;
  assert.deepEqual(await webTip({ from: noX, to: "@b1", amount: 1n, key: "key-aaaaaaaa" }, async () => ({ id: "x-b1" }), spend), { error: "Link your X account first." });
  const j = await member("j1", "x-j1", { grant: 10_000_000n });
  const known = async (h: string) => (h === "nobody" ? null : { id: "x-b1" });
  assert.deepEqual(await webTip({ from: j, to: "@nobody", amount: 1_000_000n, key: "key-aaaaaaaa" }, known, spend), { error: "We couldn't find @nobody on X." });
  assert.ok("error" in (await webTip({ from: j, to: "bad handle!", amount: 1_000_000n, key: "key-aaaaaaaa" }, known, spend)));
  assert.ok("error" in (await webTip({ from: j, to: "@b1", amount: 6_000_000n, key: "key-aaaaaaaa" }, known, spend)));
});

test("an X account can only be linked to one member", async () => {
  await db.upsertMember("k1", "k1@example.com"); await db.upsertMember("k2", "k2@example.com");
  assert.equal(await db.linkX("k1", "x-shared", "shared"), true);
  assert.equal(await db.linkX("k2", "x-shared", "shared"), false);
});

test("sessions can be revoked one at a time or all at once", async () => {
  const later = Date.now() + 60_000;
  await db.createSession("s1", "u1", later, "sealed"); await db.createSession("s2", "u1", later); await db.createSession("s3", "u2", later);
  await db.createSession("old", "u1", Date.now() - 1);
  assert.equal(await db.sessionValid("s1"), true);
  assert.equal(await db.sessionValid("old"), false);
  await db.revokeSession("s1");
  assert.equal(await db.sessionValid("s1"), false);
  assert.equal(await db.sessionValid("s2"), true);
  await db.revokeAllSessions("u1");
  assert.equal(await db.sessionValid("s2"), false);
  assert.equal(await db.sessionValid("s3"), true);
});

test("1Claw tokens are sealed at rest and tampering is detected", async () => {
  const { seal, open } = await import("../lib/crypto.ts");
  const s = seal("eyJ.token.value");
  assert.notEqual(s, "eyJ.token.value");
  assert.equal(open(s), "eyJ.token.value");
  const parts = s.split("."); parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("A") ? "BB" : "AA");
  assert.equal(open(parts.join(".")), null);
});

test("rate limit counts within a window and same-origin check rejects cross-site posts", async () => {
  const { allow, sameOrigin } = await import("../lib/security.ts");
  let n = 0;
  for (let i = 0; i < 5; i++) if (await allow("t:k", 3, 60)) n++;
  assert.equal(n, 3);
  const req = (h: Record<string, string>) => new Request("https://cheesepay.me/api/tip", { method: "POST", headers: h });
  assert.equal(sameOrigin(req({ host: "cheesepay.me", origin: "https://cheesepay.me" })), true);
  assert.equal(sameOrigin(req({ host: "cheesepay.me", origin: "https://evil.example" })), false);
  assert.equal(sameOrigin(req({ host: "cheesepay.me", "sec-fetch-site": "cross-site" })), false);
  assert.equal(sameOrigin(req({ host: "cheesepay.me" })), false);
});
