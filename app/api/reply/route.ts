import { checkProofOfWork, isCiphertext, isLookup, json, readJson } from "@/lib/server/guard";
import { getStore, sha256Hex } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const MAX = 40_000;

// A reporter's message to the platform: one copy sealed to the platform, one to herself.
export async function POST(req: Request) {
  const body = await readJson(req, 2 * MAX + 2_000);
  if (!body || !isLookup(body.lookup) || !isCiphertext(body.ciphertext, MAX) || !isCiphertext(body.copy, MAX)) {
    return json({ error: "invalid" }, 400);
  }
  if (!(await checkProofOfWork(body.pow))) return json({ error: "pow" }, 400);
  const store = getStore();
  const found = await store.findByLookup(sha256Hex(body.lookup));
  if (!found) return json({ error: "not_found" }, 404);
  await store.addMessage(found.id, "to_platform", body.ciphertext, body.copy);
  return json({ ok: true });
}
