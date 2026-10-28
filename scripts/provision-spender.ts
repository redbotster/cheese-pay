// One-time: creates the Cheese Pay "spender" as a 1Claw agent. 1Claw holds its key (never on this machine)
// and enforces guardrails on every transaction it signs.
//   node --experimental-strip-types scripts/provision-spender.ts          # dry run, prints the plan only
//   node --experimental-strip-types scripts/provision-spender.ts --apply  # creates the agent + Base signing key
// Needs ONE_CLAW_API_KEY (your personal 1ck_ key) in the environment.
import { createClient } from "@1claw/sdk";
import { appendFileSync } from "node:fs";
import { USDC } from "../lib/config.ts";

const SPEND_PERMISSION_MANAGER = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad"; // Base Account spend permissions contract

// The spender may only talk to the spend-permission contract and USDC, on Base, and never move ETH.
// The $10/day USDC cap lives onchain in each user's permission; the $1/tip cap is checked in lib/limits.ts.
export const AGENT = {
  name: "cheese-pay-spender",
  description: "Executes Cheese Pay tips from users' signed spend permissions. No custody of funds.",
  intents_api_enabled: true,
  tx_allowed_chains: ["base"],
  tx_to_allowlist: [SPEND_PERMISSION_MANAGER, USDC],
  tx_max_value: "0", // zero ETH value on every transaction
  tx_token_allowlist: [USDC],
  tx_known_tokens_only: true,
  tx_max_per_day: 600, // ~200 tips a day at up to 3 transactions each; the circuit breaker trips beyond this
} as const;

const apply = process.argv.includes("--apply");
console.log("Plan:", JSON.stringify(AGENT, null, 2));
if (!apply) { console.log("\nDry run. Re-run with --apply to create it."); process.exit(0); }

const client = createClient({ baseUrl: process.env.ONECLAW_API_BASE ?? "https://api.1claw.xyz", apiKey: process.env.ONE_CLAW_API_KEY });
const created = await client.agents.create({ ...AGENT, tx_allowed_chains: [...AGENT.tx_allowed_chains], tx_to_allowlist: [...AGENT.tx_to_allowlist], tx_token_allowlist: [...AGENT.tx_token_allowlist] });
if (!created.data) throw new Error(`create agent failed: ${created.error?.message}`);
const { agent, api_key } = created.data;
const key = await client.signingKeys.create(agent.id, { chain: "base" });
if (!key.data?.address) throw new Error(`create signing key failed: ${key.error?.message}`);

// Secrets go to .env.local only; they are never printed.
appendFileSync(".env.local", `ONECLAW_SPENDER_AGENT_ID=${agent.id}\nONECLAW_SPENDER_API_KEY=${api_key}\nSPENDER_ADDRESS=${key.data.address}\nNEXT_PUBLIC_SPENDER_ADDRESS=${key.data.address}\n`);
console.log(`Created agent ${agent.id}. Spender address: ${key.data.address}`);
console.log("Send a small amount of ETH on Base to that address for gas (about $5 lasts a long time). It never holds USDC.");
