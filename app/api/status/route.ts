import { isLookup, json, readJson } from "@/lib/server/guard";
import { getStore, sha256Hex } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// Returns a case's status and its encrypted messages. Only someone holding the
// receipt code can compute the lookup value, and only she can decrypt replies.
export async function POST(req: Request) {
  const body = await readJson(req, 1_000);
  if (!body || !isLookup(body.lookup)) return json({ error: "invalid" }, 400);
  const found = await getStore().findByLookup(sha256Hex(body.lookup));
  if (!found) return json({ error: "not_found" }, 404);
  return json({
    status: found.status,
    createdOn: found.createdOn,
    messages: found.messages.map((m) => ({
      direction: m.direction,
      // to_reporter: sealed to her; to_platform: her own copy, sealed to her.
      ciphertext: m.direction === "to_reporter" ? m.ciphertext : m.copy,
      createdOn: m.createdOn,
    })),
  });
}
