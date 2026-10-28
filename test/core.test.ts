import test from "node:test";
import assert from "node:assert/strict";
import { checkTip } from "../lib/limits.ts";

const ok = { amount: 1_000_000n, sentLast24h: 0n, selfTip: false, hasWallet: true, grantActive: true, maxTip: 1_000_000n, dailyCap: 10_000_000n, paused: false };

test("limits", () => {
  assert.equal(checkTip(ok).ok, true);
  assert.equal(checkTip({ ...ok, amount: 1_000_001n }).ok, false); // over the per-tip limit
  assert.equal(checkTip({ ...ok, sentLast24h: 9_500_000n }).ok, false); // would pass the daily limit
  assert.equal(checkTip({ ...ok, sentLast24h: 9_000_000n }).ok, true);
  assert.equal(checkTip({ ...ok, selfTip: true }).ok, false);
  assert.equal(checkTip({ ...ok, hasWallet: false }).ok, false);
  assert.equal(checkTip({ ...ok, grantActive: false }).ok, false);
  assert.equal(checkTip({ ...ok, paused: true }).ok, false);
  assert.equal(checkTip({ ...ok, amount: 0n }).ok, false);
  assert.equal(checkTip({ ...ok, amount: 2_000_000n, maxTip: 5_000_000n }).ok, true); // raised per-tip limit
});
