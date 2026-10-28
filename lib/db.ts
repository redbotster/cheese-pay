import Database from "better-sqlite3";

let _db: Database.Database | undefined;
/** Opened on first use, not at import, so `next build` workers never contend for the file. */
function d() {
  if (_db) return _db;
  _db = new Database(process.env.CHEESE_DB ?? "cheese.db");
  _db.pragma("busy_timeout = 5000");
  _db.pragma("journal_mode = WAL");
  _db.exec(`
CREATE TABLE IF NOT EXISTS users (
  x_id TEXT PRIMARY KEY, handle TEXT NOT NULL, wallet TEXT, permission TEXT, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_handle ON users(handle);
CREATE TABLE IF NOT EXISTS tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tweet_id TEXT UNIQUE NOT NULL, from_x TEXT NOT NULL, to_x TEXT NOT NULL, to_handle TEXT NOT NULL,
  amount TEXT NOT NULL, status TEXT NOT NULL, tx_hash TEXT, reason TEXT, created_at INTEGER NOT NULL, expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS seen (tweet_id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS nudges (handle TEXT PRIMARY KEY, last_at INTEGER NOT NULL);
`);
  for (const col of ["max_tip TEXT", "daily_cap TEXT", "paused INTEGER NOT NULL DEFAULT 0"]) {
    try { _db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* already there */ }
  }
  return _db;
}

export type User = { x_id: string; handle: string; wallet: string | null; permission: string | null; created_at: number; max_tip: string | null; daily_cap: string | null; paused: number };
export type Tip = { id: number; tweet_id: string; from_x: string; to_x: string; to_handle: string; amount: string; status: string; tx_hash: string | null; reason: string | null; created_at: number; expires_at: number | null };

export const upsertUser = (x_id: string, handle: string) =>
  d().prepare(`INSERT INTO users (x_id, handle, created_at) VALUES (?,?,?) ON CONFLICT(x_id) DO UPDATE SET handle=excluded.handle`).run(x_id, handle.toLowerCase(), Date.now());
export const userById = (x: string) => d().prepare(`SELECT * FROM users WHERE x_id=?`).get(x) as User | undefined;
export const userByHandle = (h: string) => d().prepare(`SELECT * FROM users WHERE handle=?`).get(h.toLowerCase()) as User | undefined;
export const setWallet = (x: string, wallet: string, permission: string, dailyCap?: bigint) =>
  d().prepare(`UPDATE users SET wallet=?, permission=?, daily_cap=COALESCE(?, daily_cap) WHERE x_id=?`).run(wallet, permission, dailyCap?.toString() ?? null, x);
export const setLimits = (x: string, maxTip: bigint, dailyCap: bigint, paused: boolean) =>
  d().prepare(`UPDATE users SET max_tip=?, daily_cap=?, paused=? WHERE x_id=?`).run(maxTip.toString(), dailyCap.toString(), paused ? 1 : 0, x);

/** Idempotent on tweet_id: returns false if this tweet was already handled. */
export const claimTip = (tweet_id: string, from_x: string, to_x: string, to_handle: string, amount: bigint, expires_at: number | null) =>
  d().prepare(`INSERT OR IGNORE INTO tips (tweet_id, from_x, to_x, to_handle, amount, status, created_at, expires_at) VALUES (?,?,?,?,?, 'new', ?, ?)`)
    .run(tweet_id, from_x, to_x, to_handle.toLowerCase(), amount.toString(), Date.now(), expires_at).changes === 1;
export const tipByTweet = (t: string) => d().prepare(`SELECT * FROM tips WHERE tweet_id=?`).get(t) as Tip | undefined;
export const setTip = (id: number, status: string, tx_hash?: string | null, reason?: string | null) =>
  d().prepare(`UPDATE tips SET status=?, tx_hash=COALESCE(?,tx_hash), reason=COALESCE(?,reason) WHERE id=?`).run(status, tx_hash ?? null, reason ?? null, id);
export const pendingFor = (to_x: string) => d().prepare(`SELECT * FROM tips WHERE to_x=? AND status='pending' AND expires_at > ?`).all(to_x, Date.now()) as Tip[];
export const expireOld = () => d().prepare(`UPDATE tips SET status='expired' WHERE status='pending' AND expires_at <= ?`).run(Date.now());

/** Counts sent AND in-flight tips so two simultaneous tips cannot both slip under the cap. */
export const sentLast24h = (from_x: string) =>
  BigInt((d().prepare(`SELECT COALESCE(SUM(CAST(amount AS INTEGER)),0) AS s FROM tips WHERE from_x=? AND status IN ('sending','sent') AND created_at > ?`)
    .get(from_x, Date.now() - 86_400_000) as { s: number }).s);
export const tipsFor = (x: string) => d().prepare(`SELECT * FROM tips WHERE from_x=? OR to_x=? ORDER BY id DESC LIMIT 50`).all(x, x) as Tip[];

export const shouldNudge = (handle: string) => {
  const r = d().prepare(`SELECT last_at FROM nudges WHERE handle=?`).get(handle.toLowerCase()) as { last_at: number } | undefined;
  if (r && Date.now() - r.last_at < 7 * 86_400_000) return false;
  d().prepare(`INSERT INTO nudges (handle,last_at) VALUES (?,?) ON CONFLICT(handle) DO UPDATE SET last_at=excluded.last_at`).run(handle.toLowerCase(), Date.now());
  return true;
};

export const markSeen = (id: string) => d().prepare(`INSERT OR IGNORE INTO seen (tweet_id) VALUES (?)`).run(id).changes === 1;
export const pendingRecipients = () => (d().prepare(`SELECT DISTINCT to_x FROM tips WHERE status='pending'`).all() as { to_x: string }[]).map((r) => r.to_x);
