import { DatabaseSync } from "node:sqlite"
import type { EncryptedCode } from "./credentials.ts"

export interface Room extends EncryptedCode {
  // Canonical company segment.
  company: string
  // Canonical meeting segment.
  slug: string
  // Current encryption and authorization version.
  codeVersion: number
}

export interface Budget {
  // Counter scope separating each policy.
  scope: string
  // Room or source key within this scope.
  key: string
  // Maximum accepted attempts in a window.
  limit: number
  // Window length in milliseconds.
  windowMs: number
}

export function openStore(path: string) {
  const db = new DatabaseSync(path)
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  )
  const version = db.prepare("PRAGMA user_version").get()?.user_version
  if (version !== 0 && version !== 1) {
    db.close()
    throw new Error("Unsupported database schema")
  }
  if (version === 0) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE rooms (company TEXT NOT NULL, slug TEXT NOT NULL, ciphertext BLOB NOT NULL, nonce BLOB NOT NULL, tag BLOB NOT NULL, code_version INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(company, slug));
      CREATE TABLE host_access (capability_hash TEXT PRIMARY KEY, company TEXT NOT NULL, slug TEXT NOT NULL, participant_identity TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY(company,slug) REFERENCES rooms(company,slug));
      CREATE INDEX host_access_room ON host_access(company,slug);
      CREATE TABLE rate_limits (scope TEXT NOT NULL, key TEXT NOT NULL, window_started_at INTEGER NOT NULL, attempts INTEGER NOT NULL, window_ms INTEGER NOT NULL, PRIMARY KEY(scope,key));
      PRAGMA user_version=1;
      COMMIT;`)
  }
  const getRoom = db.prepare("SELECT * FROM rooms WHERE company=? AND slug=?")
  const insertRoom = db.prepare(
    "INSERT INTO rooms(company,slug,ciphertext,nonce,tag,code_version,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(company,slug) DO NOTHING",
  )
  const updateRoom = db.prepare(
    "UPDATE rooms SET ciphertext=?,nonce=?,tag=?,code_version=? WHERE company=? AND slug=?",
  )
  const getAccess = db.prepare(
    "SELECT participant_identity FROM host_access WHERE capability_hash=? AND company=? AND slug=?",
  )
  const insertAccess = db.prepare("INSERT INTO host_access VALUES(?,?,?,?,?)")
  const deleteAccess = db.prepare(
    "DELETE FROM host_access WHERE capability_hash=? AND company=? AND slug=?",
  )
  const listAccess = db.prepare(
    "SELECT participant_identity FROM host_access WHERE company=? AND slug=?",
  )
  const getLimit = db.prepare(
    "SELECT window_started_at,attempts FROM rate_limits WHERE scope=? AND key=?",
  )
  const writeLimit = db.prepare(
    "INSERT INTO rate_limits VALUES(?,?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET window_started_at=excluded.window_started_at,attempts=excluded.attempts,window_ms=excluded.window_ms",
  )
  const pruneLimits = db.prepare(
    "DELETE FROM rate_limits WHERE window_started_at + window_ms <= ?",
  )
  return {
    close() {
      db.close()
    },
    health() {
      db.prepare("SELECT 1").get()
    },
    room(company: string, slug: string): Room | undefined {
      const row = getRoom.get(company, slug)
      if (!row) return undefined
      return {
        company,
        slug,
        ciphertext: row.ciphertext as Uint8Array,
        nonce: row.nonce as Uint8Array,
        tag: row.tag as Uint8Array,
        codeVersion: Number(row.code_version),
      }
    },
    create(
      company: string,
      slug: string,
      code: EncryptedCode,
      now: number,
    ): boolean {
      return (
        insertRoom.run(
          company,
          slug,
          code.ciphertext,
          code.nonce,
          code.tag,
          1,
          now,
        ).changes === 1
      )
    },
    rotate(room: Room, code: EncryptedCode, version: number) {
      updateRoom.run(
        code.ciphertext,
        code.nonce,
        code.tag,
        version,
        room.company,
        room.slug,
      )
    },
    access(hash: string, company: string, slug: string): string | undefined {
      const row = getAccess.get(hash, company, slug)
      return row ? String(row.participant_identity) : undefined
    },
    addAccess(
      hash: string,
      company: string,
      slug: string,
      identity: string,
      now: number,
    ) {
      insertAccess.run(hash, company, slug, identity, now)
    },
    revoke(hash: string, company: string, slug: string) {
      deleteAccess.run(hash, company, slug)
    },
    hosts(company: string, slug: string): string[] {
      return listAccess
        .all(company, slug)
        .map(row => String(row.participant_identity))
    },
    consume(budgets: Budget[], now: number): number {
      db.exec("BEGIN IMMEDIATE")
      try {
        pruneLimits.run(now)
        const counters = budgets.map(budget => {
          const row = getLimit.get(budget.scope, budget.key)
          const start = row ? Number(row.window_started_at) : now
          const attempts = row ? Number(row.attempts) : 0
          return { budget, start, attempts }
        })
        const retryMs = Math.max(
          0,
          ...counters
            .filter(item => item.attempts >= item.budget.limit)
            .map(item => item.start + item.budget.windowMs - now),
        )
        if (!retryMs) {
          for (const { budget, start, attempts } of counters)
            writeLimit.run(
              budget.scope,
              budget.key,
              start,
              attempts + 1,
              budget.windowMs,
            )
        }
        db.exec("COMMIT")
        return Math.ceil(retryMs / 1000)
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
    },
  }
}

export type Store = ReturnType<typeof openStore>
