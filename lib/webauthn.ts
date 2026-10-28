// Browser-side passkey ceremonies, mirroring 1Claw's own wallet widget.
export const b64urlEncode = (buf: ArrayBuffer) => {
  let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const b64urlDecode = (str: string) => {
  let s = str.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const hexBytes = (hex: string) => {
  const h = hex.replace(/^0x/, ""); const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out.buffer;
};

export function explain(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError") return "The passkey prompt was cancelled or timed out. Try again.";
  if (name === "SecurityError") return "This browser won't use a 1Claw passkey on this website. Open Cheese Pay from its main address and try again.";
  if (name === "InvalidStateError") return "This device already has a Cheese Pay passkey.";
  return (e as Error)?.message || "Something went wrong with the passkey.";
}

/** Create a passkey from 1Claw's registration options. */
export async function createPasskey(o: any) {
  const cred = (await navigator.credentials.create({ publicKey: {
    challenge: b64urlDecode(o.challenge), rp: { id: o.rp_id, name: o.rp_name ?? "1Claw" },
    user: { id: b64urlDecode(o.user_id), name: o.user_name, displayName: o.user_display_name ?? o.user_name },
    pubKeyCredParams: (o.pub_key_cred_params ?? [{ type: "public-key", alg: -7 }]).map((p: any) => ({ type: p.type, alg: p.alg })),
    timeout: o.timeout ?? 60_000, attestation: o.attestation ?? "none", authenticatorSelection: o.authenticator_selection,
    excludeCredentials: o.exclude_credentials?.map((c: any) => ({ id: b64urlDecode(c.id), type: c.type, transports: c.transports })),
  } })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Passkey setup was cancelled.");
  const r = cred.response as AuthenticatorAttestationResponse;
  return { credential_id: b64urlEncode(cred.rawId), attestation_object: b64urlEncode(r.attestationObject), client_data_json: b64urlEncode(r.clientDataJSON), transports: r.getTransports?.() };
}

/** Sign a Safe transaction: the challenge is the raw 32-byte SafeTx hash. */
export async function signSafeTx(p: { challenge: string; credentialId?: string; transports?: string[]; rpId?: string }) {
  const cred = (await navigator.credentials.get({ publicKey: {
    challenge: hexBytes(p.challenge), rpId: p.rpId, userVerification: "required", timeout: 60_000,
    allowCredentials: p.credentialId ? [{ id: b64urlDecode(p.credentialId), type: "public-key", transports: p.transports as AuthenticatorTransport[] | undefined }] : undefined,
  } })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Signing was cancelled.");
  const r = cred.response as AuthenticatorAssertionResponse;
  return { credential_id: b64urlEncode(cred.rawId), authenticator_data: b64urlEncode(r.authenticatorData), client_data_json: b64urlEncode(r.clientDataJSON), signature: b64urlEncode(r.signature) };
}

export async function post(path: string, body: unknown = {}) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.relogin) { location.href = "/login?expired=1"; throw new Error(j.error); }
  return { ok: r.ok, status: r.status, ...j };
}

/** Prepare -> passkey signature -> execute, for grants and revocations. */
export async function signAndExecute(prepPath: string, body: unknown) {
  const prep = await post(prepPath, body);
  if (!prep.ok) throw new Error(prep.error ?? "Could not prepare that.");
  const assertion = await signSafeTx(prep as any);
  const done = await post("/api/wallet/execute", assertion);
  if (!done.ok) throw new Error(done.error ?? "That didn't go through.");
  return done;
}
