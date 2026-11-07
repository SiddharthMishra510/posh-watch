import { issueChallenge, json } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

// A fresh proof-of-work challenge. Stateless: the challenge carries its own HMAC.
export async function POST() {
  return json(issueChallenge());
}
