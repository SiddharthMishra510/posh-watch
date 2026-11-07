import { isAdmin, json } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  return json({ cases: await getStore().listCases() });
}
