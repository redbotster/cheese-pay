// Thin client for the 1Claw API. User calls carry the user's own token; tips are spent by the Cheese Pay agent.
import { encodeFunctionData, parseAbi, type Address } from "viem";
import { USDC } from "./config.ts";

const API = () => process.env.ONECLAW_API_BASE ?? "https://api.1claw.xyz";
export const APP_ID = () => process.env.ONECLAW_PLATFORM_APP_ID ?? "";
export const AGENT_ID = () => process.env.ONECLAW_SPENDER_AGENT_ID ?? "";
export const ESCROW = () => (process.env.SPENDER_ADDRESS ?? "") as Address; // the agent's own key holds tips waiting for new users

export class OneclawError extends Error {
  status: number; body?: unknown;
  constructor(status: number, message: string, body?: unknown) { super(message); this.status = status; this.body = body; }
}

async function call<T>(path: string, o: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(API() + path, {
    method: o.method ?? (o.body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    cache: "no-store",
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok && r.status !== 409) throw new OneclawError(r.status, data?.detail ?? data?.message ?? `1Claw error ${r.status}`, data);
  return Object.assign(data ?? {}, { __status: r.status }) as T;
}

// ---- email sign-in (the user's 1Claw account; wallets are created on first sign-in)
export const sendOtp = (email: string) => call("/v1/auth/email-otp/send", { body: { email, platform_app_id: APP_ID() } });
// "Sign in with 1Claw" for existing 1Claw users (OAuth code + PKCE)
export const oauthToken = (code: string, redirect_uri: string, code_verifier: string) =>
  call<{ access_token: string; expires_in?: number }>("/v1/oauth/token", { body: { grant_type: "authorization_code", code, client_id: process.env.ONECLAW_OAUTH_CLIENT_ID ?? "cheese-pay", redirect_uri, code_verifier } });
export const whoAmI = (token: string) => call<{ id?: string; email?: string }>("/v1/auth/me", { token });
export type OtpResult ={ __status: number; token?: string; user_id?: string; email?: string; mfa_required?: boolean; link_required?: { authorize_url?: string } };
export const verifyOtp = (email: string, code: string) =>
  call<OtpResult>("/v1/auth/email-otp/verify", { body: { email, code, platform_app_id: APP_ID(), auto_provision_chains: ["base"], allow_signup: true } });

// ---- the user's own wallet objects (user token)
export type Passkey = { id: string; credential_id: string; name: string | null; created_at: string };
export const listPasskeys = async (t: string) => (await call<{ passkeys?: Passkey[] }>("/v1/auth/passkeys", { token: t })).passkeys ?? [];
export const passkeyRegisterBegin = (t: string) => call<Record<string, any>>("/v1/auth/passkeys/register/begin", { token: t, body: {} });
export const passkeyRegisterComplete = (t: string, body: Record<string, unknown>) => call("/v1/auth/passkeys/register/complete", { token: t, body });

export type Safe = { id: string; chain: string; safe_address: string; passkey_id: string; passkey_rp_id?: string | null; deploy_status?: string };
export const listSafes = async (t: string) => (await call<{ safes?: Safe[] }>("/v1/treasury/passkey-safes", { token: t })).safes ?? [];
export const createSafe = (t: string, passkey_id: string) => call<Safe>("/v1/treasury/passkey-safes", { token: t, body: { chain: "base", passkey_id } });

export type Grant = { id: string; agent_id: string; allowance_amount: string; status: string; token_address?: string };
export type Prepare = { safe_tx_hash: string; to: string; value_wei: string; data?: string; nonce: number; operation?: number; grant_id?: string; credential_id?: string; transports?: string[] | null; rp_id?: string };
export const listGrants = async (t: string, safeId: string) => (await call<{ grants?: Grant[] }>(`/v1/treasury/passkey-safes/${safeId}/grants`, { token: t })).grants ?? [];
export const prepareGrant = (t: string, safeId: string, allowance: bigint) =>
  call<{ grant: Grant; prepare: Prepare }>(`/v1/treasury/passkey-safes/${safeId}/grants`, { token: t, body: { agent_id: AGENT_ID(), token: USDC, allowance_amount: allowance.toString(), reset_time_min: 1440 } });
export const prepareRevoke = (t: string, safeId: string, grantId: string) =>
  call<{ grant: Grant; prepare: Prepare }>(`/v1/treasury/passkey-safes/${safeId}/grants/${grantId}/revoke`, { token: t, body: {} });
export const executeSafeTx = (t: string, safeId: string, p: Prepare, assertion: { credential_id: string; authenticator_data: string; client_data_json: string; signature: string }) =>
  call<{ tx_hash?: string; status?: string }>(`/v1/treasury/passkey-safes/${safeId}/execute`, {
    token: t, body: { to: p.to, value_wei: p.value_wei, data: p.data, nonce: p.nonce, operation: p.operation ?? 0, grant_id: p.grant_id, ...assertion },
  });
export const treasuryWallets = async (t: string) => (await call<{ wallets?: { chain: string; address: string }[] }>("/v1/treasury/wallets", { token: t })).wallets ?? [];

// ---- the Cheese Pay agent (spends only inside each user's onchain grant, under its own 1Claw guardrails)
let agentTok: { t: string; exp: number } | undefined;
async function agentToken(): Promise<string> {
  if (agentTok && agentTok.exp > Date.now() + 30_000) return agentTok.t;
  const r = await call<{ access_token: string; expires_in: number }>("/v1/auth/agent-token", { body: { agent_id: AGENT_ID(), api_key: process.env.ONECLAW_SPENDER_API_KEY } });
  agentTok = { t: r.access_token, exp: Date.now() + (r.expires_in ?? 600) * 1000 };
  return agentTok.t;
}

/** Moves `amount` USDC out of a user's passkey Safe under their grant. The Allowance Module refuses anything over the grant. */
export async function spendFromSafe(safeId: string, to: Address, amount: bigint): Promise<string> {
  const r = await call<{ tx_hash?: string; transaction_hash?: string }>(`/v1/agents/${AGENT_ID()}/passkey-safes/${safeId}/spend`, {
    token: await agentToken(), body: { to, amount: amount.toString(), token: USDC },
  });
  return r.tx_hash ?? r.transaction_hash ?? "";
}

/** Pays out a tip held in escrow (the agent's own key) to its recipient, or back to the sender. */
export async function payFromEscrow(to: Address, amount: bigint): Promise<string> {
  const data = encodeFunctionData({ abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]), functionName: "transfer", args: [to, amount] });
  const r = await call<{ tx_hash?: string; error_message?: string; status?: string }>(`/v1/agents/${AGENT_ID()}/transactions`, {
    token: await agentToken(), body: { to: USDC, value: "0", chain: "base", data, simulate_first: true },
  });
  if (!r.tx_hash) throw new OneclawError(502, r.error_message ?? "escrow transfer was not broadcast");
  return r.tx_hash;
}
