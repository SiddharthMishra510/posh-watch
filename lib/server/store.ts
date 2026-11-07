// Storage. Everything sensitive arrives already encrypted; the database only ever
// holds ciphertext, a hash of each reporter's lookup value, a status and dates.
//
// With DATABASE_URL set (Neon on Vercel) data lives in Postgres. Without it, and
// only outside production, an in-memory store is used so the app runs locally.

import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { CaseStatus } from "../status";

export type Direction = "to_reporter" | "to_platform";

export interface MessageRow {
  id: number;
  direction: Direction;
  ciphertext: string; // for the recipient
  copy: string; // for the sender's own record
  createdOn: string; // YYYY-MM-DD
}

export interface CaseSummary {
  id: number;
  ref: string;
  status: CaseStatus;
  createdOn: string;
  filedOn: string | null;
  updatedOn: string;
  unread: number; // reporter messages newer than the operator's last view
}

export interface CaseDetail extends CaseSummary {
  report: string;
  notes: string | null;
  messages: MessageRow[];
}

export interface Store {
  createCase(lookupHash: string, report: string): Promise<number>;
  findByLookup(lookupHash: string): Promise<{ id: number; status: CaseStatus; createdOn: string; messages: MessageRow[] } | null>;
  addMessage(caseId: number, direction: Direction, ciphertext: string, copy: string): Promise<void>;
  listCases(): Promise<CaseSummary[]>;
  getCase(id: number): Promise<CaseDetail | null>;
  updateCase(id: number, patch: { status?: CaseStatus; filedOn?: string | null; notes?: string | null }): Promise<boolean>;
  markRead(id: number): Promise<void>;
  /** Deletes the report and all messages; keeps the case row, status and dates. */
  purge(id: number): Promise<boolean>;
  /** Records a used proof-of-work challenge; false if it was already used. */
  claimChallenge(challengeHash: string): Promise<boolean>;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Today's date in India. Times are never stored, only dates. */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function caseRef(id: number, createdOn: string) {
  return `PR-${createdOn.slice(0, 4)}-${String(id).padStart(4, "0")}`;
}

// ---- Postgres (Neon) ---------------------------------------------------------

function neonStore(url: string): Store {
  const sql = neon(url);
  const d = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));

  const summary = (r: Record<string, unknown>): CaseSummary => ({
    id: Number(r.id),
    ref: caseRef(Number(r.id), d(r.created_on)!),
    status: r.status as CaseStatus,
    createdOn: d(r.created_on)!,
    filedOn: d(r.filed_on),
    updatedOn: d(r.updated_on)!,
    unread: Number(r.unread ?? 0),
  });
  const message = (r: Record<string, unknown>): MessageRow => ({
    id: Number(r.id),
    direction: r.direction as Direction,
    ciphertext: String(r.ciphertext),
    copy: String(r.copy),
    createdOn: d(r.created_on)!,
  });

  return {
    async createCase(lookupHash, report) {
      const today = todayIST();
      const rows = await sql`
        INSERT INTO cases (lookup_hash, report, status, created_on, updated_on)
        VALUES (${lookupHash}, ${report}, 'received', ${today}, ${today})
        RETURNING id`;
      return Number(rows[0].id);
    },
    async findByLookup(lookupHash) {
      const rows = await sql`SELECT id, status, created_on FROM cases WHERE lookup_hash = ${lookupHash}`;
      if (!rows.length) return null;
      const id = Number(rows[0].id);
      const msgs = await sql`SELECT * FROM messages WHERE case_id = ${id} ORDER BY id`;
      return { id, status: rows[0].status as CaseStatus, createdOn: d(rows[0].created_on)!, messages: msgs.map(message) };
    },
    async addMessage(caseId, direction, ciphertext, copy) {
      const today = todayIST();
      await sql`INSERT INTO messages (case_id, direction, ciphertext, copy, created_on)
                VALUES (${caseId}, ${direction}, ${ciphertext}, ${copy}, ${today})`;
      if (direction === "to_platform") {
        await sql`UPDATE cases SET unread = unread + 1, updated_on = ${today} WHERE id = ${caseId}`;
      }
    },
    async listCases() {
      const rows = await sql`SELECT id, status, created_on, filed_on, updated_on, unread FROM cases ORDER BY id DESC`;
      return rows.map(summary);
    },
    async getCase(id) {
      const rows = await sql`SELECT * FROM cases WHERE id = ${id}`;
      if (!rows.length) return null;
      const msgs = await sql`SELECT * FROM messages WHERE case_id = ${id} ORDER BY id`;
      return { ...summary(rows[0]), report: String(rows[0].report), notes: (rows[0].notes as string) ?? null, messages: msgs.map(message) };
    },
    async updateCase(id, patch) {
      const today = todayIST();
      const cur = await sql`SELECT status, filed_on, notes FROM cases WHERE id = ${id}`;
      if (!cur.length) return false;
      const status = patch.status ?? cur[0].status;
      const filedOn = patch.filedOn !== undefined ? patch.filedOn : cur[0].filed_on;
      const notes = patch.notes !== undefined ? patch.notes : cur[0].notes;
      await sql`UPDATE cases SET status = ${status}, filed_on = ${filedOn}, notes = ${notes}, updated_on = ${today}
                WHERE id = ${id}`;
      return true;
    },
    async markRead(id) {
      await sql`UPDATE cases SET unread = 0 WHERE id = ${id}`;
    },
    async purge(id) {
      const rows = await sql`UPDATE cases SET report = 'PURGED', notes = NULL, unread = 0 WHERE id = ${id} RETURNING id`;
      await sql`DELETE FROM messages WHERE case_id = ${id}`;
      return rows.length === 1;
    },
    async claimChallenge(challengeHash) {
      const rows = await sql`INSERT INTO used_challenges (hash, used_on) VALUES (${challengeHash}, ${todayIST()})
                             ON CONFLICT (hash) DO NOTHING RETURNING hash`;
      // Old challenges are useless after 15 minutes; keep the table small.
      await sql`DELETE FROM used_challenges WHERE used_on < CURRENT_DATE - 2`;
      return rows.length === 1;
    },
  };
}

// ---- In-memory (local development and tests only) ------------------------------

function memoryStore(): Store {
  type Row = { id: number; lookupHash: string; report: string; status: CaseStatus; createdOn: string; filedOn: string | null; updatedOn: string; notes: string | null; unread: number };
  const cases: Row[] = [];
  const messages: (MessageRow & { caseId: number })[] = [];
  const used = new Set<string>();
  const sum = (r: Row): CaseSummary => ({ id: r.id, ref: caseRef(r.id, r.createdOn), status: r.status, createdOn: r.createdOn, filedOn: r.filedOn, updatedOn: r.updatedOn, unread: r.unread });
  const msgs = (id: number) => messages.filter((m) => m.caseId === id).map(({ caseId: _c, ...m }) => m);

  return {
    async createCase(lookupHash, report) {
      const id = cases.length + 1;
      const today = todayIST();
      cases.push({ id, lookupHash, report, status: "received", createdOn: today, filedOn: null, updatedOn: today, notes: null, unread: 0 });
      return id;
    },
    async findByLookup(lookupHash) {
      const r = cases.find((c) => c.lookupHash === lookupHash);
      return r ? { id: r.id, status: r.status, createdOn: r.createdOn, messages: msgs(r.id) } : null;
    },
    async addMessage(caseId, direction, ciphertext, copy) {
      messages.push({ id: messages.length + 1, caseId, direction, ciphertext, copy, createdOn: todayIST() });
      const r = cases.find((c) => c.id === caseId);
      if (r && direction === "to_platform") {
        r.unread += 1;
        r.updatedOn = todayIST();
      }
    },
    async listCases() {
      return [...cases].reverse().map(sum);
    },
    async getCase(id) {
      const r = cases.find((c) => c.id === id);
      return r ? { ...sum(r), report: r.report, notes: r.notes, messages: msgs(id) } : null;
    },
    async updateCase(id, patch) {
      const r = cases.find((c) => c.id === id);
      if (!r) return false;
      if (patch.status) r.status = patch.status;
      if (patch.filedOn !== undefined) r.filedOn = patch.filedOn;
      if (patch.notes !== undefined) r.notes = patch.notes;
      r.updatedOn = todayIST();
      return true;
    },
    async markRead(id) {
      const r = cases.find((c) => c.id === id);
      if (r) r.unread = 0;
    },
    async purge(id) {
      const r = cases.find((c) => c.id === id);
      if (!r) return false;
      r.report = "PURGED";
      r.notes = null;
      r.unread = 0;
      for (let i = messages.length - 1; i >= 0; i--) if (messages[i].caseId === id) messages.splice(i, 1);
      return true;
    },
    async claimChallenge(hash) {
      if (used.has(hash)) return false;
      used.add(hash);
      return true;
    },
  };
}

const globalForStore = globalThis as unknown as { __poshStore?: Store };

export function getStore(): Store {
  if (globalForStore.__poshStore) return globalForStore.__poshStore;
  const url = process.env.DATABASE_URL;
  if (url) {
    globalForStore.__poshStore = neonStore(url);
  } else if (process.env.NODE_ENV !== "production" || process.env.ALLOW_MEMORY_STORE === "1") {
    globalForStore.__poshStore = memoryStore();
  } else {
    throw new Error("DATABASE_URL is not set");
  }
  return globalForStore.__poshStore;
}
