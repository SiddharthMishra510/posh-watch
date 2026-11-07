import { checkProofOfWork, isCiphertext, isLookup, json, readJson } from "@/lib/server/guard";
import { getStore, sha256Hex } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// Vercel caps request bodies at 4.5 MB; the form keeps reports well under this.
const MAX_REPORT = 4_200_000;

export async function POST(req: Request) {
  const body = await readJson(req, MAX_REPORT + 2_000);
  if (!body || !isLookup(body.lookup) || !isCiphertext(body.report, MAX_REPORT)) {
    return json({ error: "invalid" }, 400);
  }
  if (!(await checkProofOfWork(body.pow))) return json({ error: "pow" }, 400);
  const store = getStore();
  const lookupHash = sha256Hex(body.lookup);
  if (await store.findByLookup(lookupHash)) return json({ error: "duplicate" }, 409);
  await store.createCase(lookupHash, body.report);
  return json({ ok: true });
}
