// One-time: creates the Cheese Pay "spender" as a 1Claw agent. 1Claw holds its key (never on this machine)
// and enforces guardrails on every transaction it signs.
//   node --experimental-strip-types scripts/provision-spender.ts          # dry run, prints the plan only
//   node --experimental-strip-types scripts/provision-spender.ts --apply  # creates the agent + Base signing key
// Needs ONE_CLAW_API_KEY (your personal 1ck_ key) in the environment.
import { createClient } from "@1claw/sdk";
import { appendFileSync } from "node:fs";
import { USDC } from "../lib/config.ts";

// The agent spends from users' passkey Safes under their Allowance Module grants (the onchain daily cap) and pays out escrow.
// Recipients are arbitrary Safes, so there is no destination allowlist; instead: Base only, USDC only, zero ETH value, a daily count.
export const AGENT = {
  name: "cheese-pay-spender",
  description: "Sends Cheese Pay tips from users' passkey Safes under their onchain grants, and holds tips for new users.",
  intents_api_enabled: true,
  tx_allowed_chains: ["base"],
  tx_max_value: "0", // zero ETH value on every transaction
  tx_token_allowlist: [USDC],
  tx_known_tokens_only: true,
  tx_max_per_day: 600, // ~200 tips a day at up to 3 transactions each; the circuit breaker trips beyond this
} as const;

const apply = process.argv.includes("--apply");
console.log("Plan:", JSON.stringify(AGENT, null, 2));
if (!apply) { console.log("\nDry run. Re-run with --apply to create it."); process.exit(0); }

const client = createClient({ baseUrl: process.env.ONECLAW_API_BASE ?? "https://api.1claw.xyz", apiKey: process.env.ONE_CLAW_API_KEY });
if (process.argv.includes("--update")) { // apply the guardrails above to the existing agent
  const id = process.env.ONECLAW_SPENDER_AGENT_ID!;
  const r = await client.agents.update(id, { tx_allowed_chains: [...AGENT.tx_allowed_chains], tx_to_allowlist: [], tx_max_value: AGENT.tx_max_value,
    tx_token_allowlist: [...AGENT.tx_token_allowlist], tx_known_tokens_only: true, tx_max_per_day: AGENT.tx_max_per_day } as never);
  console.log(r.error ? `update failed: ${r.error.message}` : `updated agent ${id}`);
  process.exit(r.error ? 1 : 0);
}
const created = await client.agents.create({ ...AGENT, tx_allowed_chains: [...AGENT.tx_allowed_chains], tx_token_allowlist: [...AGENT.tx_token_allowlist] });
if (!created.data) throw new Error(`create agent failed: ${created.error?.message}`);
const { agent, api_key } = created.data;
const key = await client.signingKeys.create(agent.id, { chain: "base" });
if (!key.data?.address) throw new Error(`create signing key failed: ${key.error?.message}`);

// Secrets go to .env.local only; they are never printed.
appendFileSync(".env.local", `ONECLAW_SPENDER_AGENT_ID=${agent.id}\nONECLAW_SPENDER_API_KEY=${api_key}\nSPENDER_ADDRESS=${key.data.address}\nNEXT_PUBLIC_SPENDER_ADDRESS=${key.data.address}\n`);
console.log(`Created agent ${agent.id}. Spender address: ${key.data.address}`);
console.log("Send a small amount of ETH on Base to that address for gas (about $5 lasts a long time). It never holds USDC.");
