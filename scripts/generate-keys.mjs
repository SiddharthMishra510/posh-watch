// Creates the platform key pair and an admin token.
//   npm run keys
// Keep platform-key.json OFF the server and out of git: whoever holds it can read
// every report. Store a second copy somewhere offline (an encrypted USB stick).
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { generatePlatformKeys } from "../lib/crypto-core.js";

const file = "platform-key.json";
if (existsSync(file)) {
  console.error(`${file} already exists. Move it somewhere safe before making a new one;`);
  console.error("a new key cannot read reports encrypted to the old one.");
  process.exit(1);
}
const keys = await generatePlatformKeys();
writeFileSync(file, JSON.stringify({ ...keys, created: new Date().toISOString().slice(0, 10) }, null, 2), { mode: 0o600 });

console.log(`Private key written to ${file}. Do not upload it anywhere.\n`);
console.log("Add these to Vercel > Project > Settings > Environment Variables:\n");
console.log(`NEXT_PUBLIC_PLATFORM_PUBLIC_KEY=${keys.publicKey}`);
console.log(`ADMIN_TOKEN=${randomBytes(32).toString("base64url")}`);
console.log(`POW_SECRET=${randomBytes(32).toString("hex")}`);
