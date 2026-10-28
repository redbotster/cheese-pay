import { createClient, type Client } from "@libsql/client";

export type User = { x_id: string; handle: string; wallet: string | null; permission: string | null; created_at: number; max_tip: string | null; daily_cap: string | null; paused: number };
export type Tip = { mode?: string | null; release_tx?: string | null; id: number; tweet_id: string; from_x: string; to_x: string; to_handle: string; amount: string; status: string; tx_hash: string | null; reason: string | null; created_at: number; expires_at: number | null };

let ready: Promise<Client> | undefined;
/** Turso in production (TURSO_DATABASE_URL), a local file in dev. Opened on first use so `next build` never touches it. */
function db(): Promise<Client> {
  return (ready ??= (async () => {
    const c = createClient({ url: process.env.TURSO_DATABASE_URL ?? process.env.CHEESE_DB ?? "file:cheese.db", authToken: process.env.TURSO_AUTH_TOKEN });
    await c.batch([
      `CREATE TABLE IF NOT EXISTS users (x_id TEXT PRIMARY KEY, handle TEXT NOT NULL, wallet TEXT, permission TEXT, created_at INTEGER NOT NULL, max_tip TEXT, daily_cap TEXT, paused INTEGER NOT NULL DEFAULT 0)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS users_handle ON users(handle)`,
      `CREATE TABLE IF NOT EXISTS tips (id INTEGER PRIMARY KEY AUTOINCREMENT, tweet_id TEXT UNIQUE NOT NULL, from_x TEXT NOT NULL, to_x TEXT NOT NULL, to_handle TEXT NOT NULL,
        amount TEXT NOT NULL, status TEXT NOT NULL, tx_hash TEXT, reason TEXT, created_at INTEGER NOT NULL, expires_at INTEGER)`,
      `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS seen (tweet_id TEXT PRIMARY KEY)`,
      `CREATE TABLE IF NOT EXISTS handles (handle TEXT PRIMARY KEY, x_id TEXT NOT NULL, at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS members (uid TEXT PRIMARY KEY, email TEXT NOT NULL, x_id TEXT UNIQUE, handle TEXT, safe_id TEXT, safe_address TEXT,
        grant_id TEXT, grant_amount TEXT, grant_status TEXT, max_tip TEXT, daily_cap TEXT, paused INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS user_sessions (sid TEXT PRIMARY KEY, uid TEXT NOT NULL, token_enc TEXT, token_exp INTEGER, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)`,
      `CREATE INDEX IF NOT EXISTS user_sessions_uid ON user_sessions(uid)`,
      `CREATE TABLE IF NOT EXISTS ratelimit (k TEXT NOT NULL, w INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, w))`,
      `CREATE TABLE IF NOT EXISTS nudges (handle TEXT PRIMARY KEY, last_at INTEGER NOT NULL)`,
    ]);
    for (const col of ["mode TEXT", "release_tx TEXT"]) { try { await c.execute(`ALTER TABLE tips ADD COLUMN ${col}`); } catch { /* already there */ } }
    return c;
  })());
}

async function all<T>(sql: string, args: (string | number | null)[] = []): Promise<T[]> {
  return (await (await db()).execute({ sql, args })).rows as unknown as T[];
}
async function run(sql: string, args: (string | number | null)[] = []): Promise<number> {
  return (await (await db()).execute({ sql, args })).rowsAffected;
}
async function one<T>(sql: string, args: (string | number | null)[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export type Member = { uid: string; email: string; x_id: string | null; handle: string | null; safe_id: string | null; safe_address: string | null;
  grant_id: string | null; grant_amount: string | null; grant_status: string | null; max_tip: string | null; daily_cap: string | null; paused: number; created_at: number };

export const upsertMember = (uid: string, email: string) =>
  run(`INSERT INTO members (uid, email, created_at) VALUES (?,?,?) ON CONFLICT(uid) DO UPDATE SET email=excluded.email`, [uid, email.toLowerCase(), Date.now()]);
export const memberById = (uid: string) => one<Member>(`SELECT * FROM members WHERE uid=?`, [uid]);
export const memberByX = (x: string) => one<Member>(`SELECT * FROM members WHERE x_id=?`, [x]);
/** Returns false if that X account is already linked to someone else. */
export const linkX = async (uid: string, x_id: string, handle: string) => {
  const other = await memberByX(x_id);
  if (other && other.uid !== uid) return false;
  await run(`UPDATE members SET x_id=?, handle=? WHERE uid=?`, [x_id, handle.toLowerCase(), uid]);
  return true;
};
export const setSafe = (uid: string, safe_id: string, safe_address: string) => run(`UPDATE members SET safe_id=?, safe_address=? WHERE uid=?`, [safe_id, safe_address, uid]);
export const setGrant = (uid: string, grant_id: string | null, amount: bigint | null, status: string | null) =>
  run(`UPDATE members SET grant_id=?, grant_amount=?, grant_status=? WHERE uid=?`, [grant_id, amount?.toString() ?? null, status, uid]);
export const setLimits = (uid: string, maxTip: bigint, dailyCap: bigint, paused: boolean) =>
  run(`UPDATE members SET max_tip=?, daily_cap=?, paused=? WHERE uid=?`, [maxTip.toString(), dailyCap.toString(), paused ? 1 : 0, uid]);

/** Idempotent on tweet_id: returns false if this tweet was already handled. */
export const claimTip = async (tweet_id: string, from_x: string, to_x: string, to_handle: string, amount: bigint, expires_at: number | null) =>
  (await run(`INSERT OR IGNORE INTO tips (tweet_id, from_x, to_x, to_handle, amount, status, created_at, expires_at) VALUES (?,?,?,?,?, 'new', ?, ?)`,
    [tweet_id, from_x, to_x, to_handle.toLowerCase(), amount.toString(), Date.now(), expires_at])) === 1;
export const setTipRelease = (id: number, status: string, tx: string | null, reason?: string | null) =>
  run(`UPDATE tips SET status=?, release_tx=COALESCE(?,release_tx), reason=COALESCE(?,reason) WHERE id=?`, [status, tx, reason ?? null, id]);
export const setTipMode = (id: number, mode: string) => run(`UPDATE tips SET mode=? WHERE id=?`, [mode, id]);
export const tipByTweet = (t: string) => one<Tip>(`SELECT * FROM tips WHERE tweet_id=?`, [t]);
export const setTip = (id: number, status: string, tx_hash?: string | null, reason?: string | null) =>
  run(`UPDATE tips SET status=?, tx_hash=COALESCE(?,tx_hash), reason=COALESCE(?,reason) WHERE id=?`, [status, tx_hash ?? null, reason ?? null, id]);
export const pendingFor = (to_x: string) => all<Tip>(`SELECT * FROM tips WHERE to_x=? AND status='pending' AND expires_at > ?`, [to_x, Date.now()]);
/** Marks overdue pending tips expired and returns exactly the ones it expired, so each sender is told once. */
export const expireOld = async (webOnly = false) => {
  const out: Tip[] = [];
  for (const t of await all<Tip>(`SELECT * FROM tips WHERE status='pending' AND expires_at <= ?` + (webOnly ? ` AND tweet_id LIKE 'web:%'` : ""), [Date.now()]))
    if ((await run(`UPDATE tips SET status='expired' WHERE id=? AND status='pending'`, [t.id])) === 1) out.push(t);
  return out;
};

/** Money already committed in the last 24h: sent, in flight, and waiting for a recipient. Waiting tips reserve
 *  capacity so nobody can queue more than their daily limit. `excludeId` lets a waiting tip be re-checked without counting itself. */
export const sentLast24h = async (from_x: string, excludeId = 0) =>
  BigInt((await one<{ s: string }>(`SELECT CAST(COALESCE(SUM(CAST(amount AS INTEGER)),0) AS TEXT) AS s FROM tips WHERE from_x=? AND id<>? AND status IN ('sending','sent','pending') AND created_at > ?`,
    [from_x, excludeId, Date.now() - 86_400_000]))!.s);
export const tipsFor = (x: string) => all<Tip>(`SELECT * FROM tips WHERE from_x=? OR to_x=? ORDER BY id DESC LIMIT 50`, [x, x]);

export const shouldNudge = async (handle: string) => {
  const r = await one<{ last_at: number }>(`SELECT last_at FROM nudges WHERE handle=?`, [handle.toLowerCase()]);
  if (r && Date.now() - Number(r.last_at) < 7 * 86_400_000) return false;
  await run(`INSERT INTO nudges (handle,last_at) VALUES (?,?) ON CONFLICT(handle) DO UPDATE SET last_at=excluded.last_at`, [handle.toLowerCase(), Date.now()]);
  return true;
};
export const markSeen = async (id: string) => (await run(`INSERT OR IGNORE INTO seen (tweet_id) VALUES (?)`, [id])) === 1;
export const pendingRecipients = async () => (await all<{ to_x: string }>(`SELECT DISTINCT to_x FROM tips WHERE status='pending'`)).map((r) => r.to_x);
export const kvGet = async (k: string) => (await one<{ v: string }>(`SELECT v FROM kv WHERE k=?`, [k]))?.v;
export const kvSet = (k: string, v: string) => run(`INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [k, v]);

export const cachedHandle = async (handle: string) => (await one<{ x_id: string; at: number }>(`SELECT x_id, at FROM handles WHERE handle=?`, [handle.toLowerCase()]));
export const cacheHandle = (handle: string, x_id: string) =>
  run(`INSERT INTO handles (handle,x_id,at) VALUES (?,?,?) ON CONFLICT(handle) DO UPDATE SET x_id=excluded.x_id, at=excluded.at`, [handle.toLowerCase(), x_id, Date.now()]);

// ---- sessions: a signed cookie alone is not enough, the session must also exist here and not be revoked
export const createSession = (sid: string, uid: string, expires_at: number, token_enc: string | null = null, token_exp: number | null = null) =>
  run(`INSERT INTO user_sessions (sid, uid, token_enc, token_exp, created_at, expires_at) VALUES (?,?,?,?,?,?)`, [sid, uid, token_enc, token_exp, Date.now(), expires_at]);
export const sessionRow = (sid: string) =>
  one<{ uid: string; token_enc: string | null; token_exp: number | null }>(`SELECT uid, token_enc, token_exp FROM user_sessions WHERE sid=? AND revoked=0 AND expires_at > ?`, [sid, Date.now()]);
export const sessionValid = async (sid: string) => !!(await sessionRow(sid));
export const revokeSession = (sid: string) => run(`UPDATE user_sessions SET revoked=1, token_enc=NULL WHERE sid=?`, [sid]);
export const revokeAllSessions = (uid: string) => run(`UPDATE user_sessions SET revoked=1, token_enc=NULL WHERE uid=? AND revoked=0`, [uid]);

/** Fixed-window counter. Returns how many hits this key has had in the current window, including this one. */
export const hit = async (key: string, windowSec: number) => {
  const w = Math.floor(Date.now() / 1000 / windowSec);
  const r = await one<{ n: number }>(`INSERT INTO ratelimit (k, w, n) VALUES (?,?,1) ON CONFLICT(k, w) DO UPDATE SET n = n + 1 RETURNING n`, [key, w]);
  if (Math.random() < 0.01) await run(`DELETE FROM ratelimit WHERE w < ?`, [w - 2]); // cheap housekeeping
  return Number(r?.n ?? 1);
};

export const escrowedExpired = () => all<Tip>(`SELECT * FROM tips WHERE status='pending' AND mode='escrow' AND expires_at <= ?`, [Date.now()]);
export const pendingEscrowFor = (to_x: string) => all<Tip>(`SELECT * FROM tips WHERE to_x=? AND status='pending' AND mode='escrow' AND expires_at > ?`, [to_x, Date.now()]);
export const pruneSessions = () => run(`DELETE FROM user_sessions WHERE expires_at < ?`, [Date.now() - 86_400_000]);
/** Test helper: pretend a pending tip's 7 days are up. */
export const forceExpire = (id: number) => run(`UPDATE tips SET expires_at=? WHERE id=?`, [Date.now() - 1000, id]);
