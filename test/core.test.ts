import test from "node:test";
import assert from "node:assert/strict";
import { parseTip } from "../lib/parse.ts";
import { checkTip } from "../lib/limits.ts";

const ok = { amount: 1_000_000n, sentLast24h: 0n, selfTip: false, hasWallet: true, permissionActive: true };

test("parses dollar tips", () => {
  assert.deepEqual(parseTip("@1clawAI tip @alice $1", "1clawAI"), { toHandle: "alice", amount: 1_000_000n });
  assert.deepEqual(parseTip("hey @1clawAI tip @Bob_9 $0.50 great thread", "1clawAI"), { toHandle: "Bob_9", amount: 500_000n });
  assert.deepEqual(parseTip("@1clawAI tip @alice 0.25 usdc", "1clawAI"), { toHandle: "alice", amount: 250_000n });
});
test("ignores non-tips, rejects ambiguous or oversize", () => {
  assert.equal(parseTip("@1clawAI hello", "1clawAI"), null);
  assert.equal(parseTip("tip @alice $1", "1clawAI"), null);
  assert.ok("error" in parseTip("@1clawAI tip @alice @carol $1", "1clawAI")!);
  assert.ok("error" in parseTip("@1clawAI tip @alice $5", "1clawAI")!);
  assert.ok("error" in parseTip("@1clawAI tip @alice", "1clawAI")!);
  assert.ok("error" in parseTip("@1clawAI tip @alice $0", "1clawAI")!);
});
test("limits", () => {
  assert.equal(checkTip(ok).ok, true);
  assert.equal(checkTip({ ...ok, amount: 1_000_001n }).ok, false);
  assert.equal(checkTip({ ...ok, sentLast24h: 9_500_000n }).ok, false);
  assert.equal(checkTip({ ...ok, sentLast24h: 9_000_000n }).ok, true);
  assert.equal(checkTip({ ...ok, selfTip: true }).ok, false);
  assert.equal(checkTip({ ...ok, hasWallet: false }).ok, false);
  assert.equal(checkTip({ ...ok, permissionActive: false }).ok, false);
});
