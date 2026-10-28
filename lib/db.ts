import { createClient, type Client } from "@libsql/client";

export type User = { x_id: string; handle: string; wallet: string | null; permission: string | null; created_at: number; max_tip: string | null; daily_cap: string | null; paused: number };
export type Tip = { id: number; tweet_id: string; from_x: string; to_x: string; to_handle: string; amount: string; status: string; tx_hash: string | null; reason: string | null; created_at: number; expires_at: number | null };

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
      `CREATE TABLE IF NOT EXISTS nudges (handle TEXT PRIMARY KEY, last_at INTEGER NOT NULL)`,
    ]);
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

export const upsertUser = (x_id: string, handle: string) =>
  run(`INSERT INTO users (x_id, handle, created_at) VALUES (?,?,?) ON CONFLICT(x_id) DO UPDATE SET handle=excluded.handle`, [x_id, handle.toLowerCase(), Date.now()]);
export const userById = (x: string) => one<User>(`SELECT * FROM users WHERE x_id=?`, [x]);
export const userByHandle = (h: string) => one<User>(`SELECT * FROM users WHERE handle=?`, [h.toLowerCase()]);
export const setWallet = (x: string, wallet: string, permission: string, dailyCap?: bigint) =>
  run(`UPDATE users SET wallet=?, permission=?, daily_cap=COALESCE(?, daily_cap) WHERE x_id=?`, [wallet, permission, dailyCap?.toString() ?? null, x]);
export const setLimits = (x: string, maxTip: bigint, dailyCap: bigint, paused: boolean) =>
  run(`UPDATE users SET max_tip=?, daily_cap=?, paused=? WHERE x_id=?`, [maxTip.toString(), dailyCap.toString(), paused ? 1 : 0, x]);

/** Idempotent on tweet_id: returns false if this tweet was already handled. */
export const claimTip = async (tweet_id: string, from_x: string, to_x: string, to_handle: string, amount: bigint, expires_at: number | null) =>
  (await run(`INSERT OR IGNORE INTO tips (tweet_id, from_x, to_x, to_handle, amount, status, created_at, expires_at) VALUES (?,?,?,?,?, 'new', ?, ?)`,
    [tweet_id, from_x, to_x, to_handle.toLowerCase(), amount.toString(), Date.now(), expires_at])) === 1;
export const tipByTweet = (t: string) => one<Tip>(`SELECT * FROM tips WHERE tweet_id=?`, [t]);
export const setTip = (id: number, status: string, tx_hash?: string | null, reason?: string | null) =>
  run(`UPDATE tips SET status=?, tx_hash=COALESCE(?,tx_hash), reason=COALESCE(?,reason) WHERE id=?`, [status, tx_hash ?? null, reason ?? null, id]);
export const pendingFor = (to_x: string) => all<Tip>(`SELECT * FROM tips WHERE to_x=? AND status='pending' AND expires_at > ?`, [to_x, Date.now()]);
/** Marks overdue pending tips expired and returns exactly the ones it expired, so each sender is told once. */
export const expireOld = async () => {
  const out: Tip[] = [];
  for (const t of await all<Tip>(`SELECT * FROM tips WHERE status='pending' AND expires_at <= ?`, [Date.now()]))
    if ((await run(`UPDATE tips SET status='expired' WHERE id=? AND status='pending'`, [t.id])) === 1) out.push(t);
  return out;
};

/** Counts sent AND in-flight tips so two simultaneous tips cannot both slip under the cap. */
export const sentLast24h = async (from_x: string) =>
  BigInt((await one<{ s: string }>(`SELECT CAST(COALESCE(SUM(CAST(amount AS INTEGER)),0) AS TEXT) AS s FROM tips WHERE from_x=? AND status IN ('sending','sent') AND created_at > ?`,
    [from_x, Date.now() - 86_400_000]))!.s);
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
