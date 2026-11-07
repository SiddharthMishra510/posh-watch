import { isAdmin, isCiphertext, json, readJson } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";
import { type CaseStatus, isCaseStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

const MAX_NOTE = 200_000;
const MAX_MSG = 40_000;

/** Full case: encrypted report, encrypted notes and messages. Marks reporter messages read. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return json({ error: "invalid" }, 400);
  const store = getStore();
  const found = await store.getCase(id);
  if (!found) return json({ error: "not_found" }, 404);
  await store.markRead(id);
  return json({ case: found });
}

/** Updates status, filing date or notes, and/or sends a message to the reporter. */
export async function POST(req: Request) {
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const body = await readJson(req, MAX_NOTE + 2 * MAX_MSG + 2_000);
  if (!body) return json({ error: "invalid" }, 400);
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return json({ error: "invalid" }, 400);

  const patch: { status?: CaseStatus; filedOn?: string | null; notes?: string | null } = {};
  if (body.status !== undefined) {
    if (!isCaseStatus(body.status)) return json({ error: "invalid status" }, 400);
    patch.status = body.status;
  }
  if (body.filedOn !== undefined) {
    if (body.filedOn !== null && !(typeof body.filedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.filedOn))) {
      return json({ error: "invalid date" }, 400);
    }
    patch.filedOn = body.filedOn as string | null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && !isCiphertext(body.notes, MAX_NOTE)) return json({ error: "invalid notes" }, 400);
    patch.notes = body.notes as string | null;
  }

  const store = getStore();
  if (!(await store.updateCase(id, patch))) return json({ error: "not_found" }, 404);

  if (body.message !== undefined) {
    const m = body.message as { ciphertext?: unknown; copy?: unknown };
    if (!isCiphertext(m?.ciphertext, MAX_MSG) || !isCiphertext(m?.copy, MAX_MSG)) {
      return json({ error: "invalid message" }, 400);
    }
    await store.addMessage(id, "to_reporter", m.ciphertext, m.copy);
  }
  return json({ ok: true });
}

/** Deletes the report and messages for a closed case (the 90-day retention rule). */
export async function DELETE(req: Request) {
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return json({ error: "invalid" }, 400);
  return (await getStore().purge(id)) ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
