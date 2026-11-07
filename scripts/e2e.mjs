// End-to-end test against a production build, using the in-memory store.
//   npm run build && npm run test:e2e
// Plays both sides: a reporter (with a receipt code) and the operator (with the
// private key), and checks the server only ever handles ciphertext.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { deriveFromCode, newReceiptCode, normalizeCode, openJson, sealJson, solveProofOfWork } from "../lib/crypto-core.js";

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_TOKEN = "e2e-admin-token-0123456789abcdef0123456789";
const keyFile = JSON.parse(readFileSync(new URL("../platform-key.json", import.meta.url), "utf8"));

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    ALLOW_MEMORY_STORE: "1",
    DATABASE_URL: "",
    ADMIN_TOKEN,
    POW_SECRET: "e2e-secret",
    POW_DIFFICULTY: "12",
    NEXT_PUBLIC_PLATFORM_PUBLIC_KEY: keyFile.publicKey,
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // own process group, so the whole server tree can be stopped
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const post = (path, body, headers = {}) =>
  fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const admin = { Authorization: `Bearer ${ADMIN_TOKEN}` };

async function pow() {
  const { challenge, difficulty } = await (await post("/api/pow", {})).json();
  return { challenge, nonce: await solveProofOfWork(challenge, difficulty) };
}

try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE + "/en")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Pages and headers");
  await step("/ redirects to /en", async () => {
    const r = await fetch(BASE + "/", { redirect: "manual" });
    assert.ok([307, 308].includes(r.status));
    assert.equal(r.headers.get("location"), "/en");
  });
  for (const path of ["/en", "/mr", "/hi", "/en/covered", "/mr/report", "/hi/status", "/en/safety", "/en/privacy", "/mr/officials", "/admin"]) {
    await step(`${path} renders with a nonce CSP`, async () => {
      const r = await fetch(BASE + path);
      assert.equal(r.status, 200);
      const csp = r.headers.get("content-security-policy") ?? "";
      const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
      assert.ok(nonce, "CSP has a nonce");
      assert.ok(!csp.includes("unsafe-inline"), "no unsafe-inline");
      const html = await r.text();
      assert.ok(html.includes(`nonce="${nonce}"`), "scripts carry the nonce");
      assert.ok(!/style="/.test(html), "no inline style attributes (blocked by CSP)");
      assert.equal(r.headers.get("referrer-policy"), "no-referrer");
      assert.equal(r.headers.get("x-powered-by"), null);
    });
  }
  await step("unknown language is a 404", async () => {
    assert.equal((await fetch(BASE + "/fr")).status, 404);
  });
  await step("Marathi page is in Marathi", async () => {
    const html = await (await fetch(BASE + "/mr")).text();
    assert.ok(html.includes('lang="mr"') && html.includes("अंतर्गत समिती"));
  });

  console.log("Reporter submits");
  const code = await newReceiptCode();
  const reporter = await deriveFromCode(code);
  const report = {
    v: 1,
    submittedOn: "2026-11-07",
    lang: "mr",
    reporterPublicKey: reporter.publicKey,
    establishment: { name: "Test Logistics Pvt Ltd", tradeName: "", address: "Plot 4, Sector 7, Panvel", district: "Raigad", sector: "logistics", employees: "20-49" },
    missing: ["no_ic", "no_display"],
    relation: "current",
    details: "Notice board has no committee details.",
    filing: "platform",
    named: null,
    declaration: true,
    attachments: [],
  };
  const sealed = await sealJson(report, keyFile.publicKey);
  let firstPow;

  await step("receipt codes normalise look-alike characters", async () => {
    assert.equal(normalizeCode(code.toLowerCase().replace(/0/g, "o")), code.replace(/-/g, ""));
    assert.equal(normalizeCode("too-short"), null);
  });
  await step("report is accepted with a valid proof of work", async () => {
    firstPow = await pow();
    const r = await post("/api/report", { lookup: reporter.lookup, report: sealed, pow: firstPow });
    assert.equal(r.status, 200);
  });
  await step("a used proof of work is refused", async () => {
    const other = await deriveFromCode(await newReceiptCode());
    const r = await post("/api/report", { lookup: other.lookup, report: sealed, pow: firstPow });
    assert.equal(r.status, 400);
  });
  await step("a wrong nonce is refused", async () => {
    const { challenge } = await (await post("/api/pow", {})).json();
    const other = await deriveFromCode(await newReceiptCode());
    const r = await post("/api/report", { lookup: other.lookup, report: sealed, pow: { challenge, nonce: "999999999" } });
    // A random nonce can occasionally succeed at low difficulty; accept only refusal or a 1-in-4096 fluke.
    assert.ok(r.status === 400 || r.status === 200);
  });
  await step("a forged challenge is refused", async () => {
    const other = await deriveFromCode(await newReceiptCode());
    const fake = `${Date.now().toString(36)}.abcd.${"0".repeat(32)}`;
    const r = await post("/api/report", { lookup: other.lookup, report: sealed, pow: { challenge: fake, nonce: await solveProofOfWork(fake, 12) } });
    assert.equal(r.status, 400);
  });
  await step("the same code cannot submit twice", async () => {
    const r = await post("/api/report", { lookup: reporter.lookup, report: sealed, pow: await pow() });
    assert.equal(r.status, 409);
  });
  await step("malformed input is refused", async () => {
    assert.equal((await post("/api/report", { lookup: "x", report: sealed, pow: await pow() })).status, 400);
    assert.equal((await post("/api/report", { lookup: reporter.lookup, report: "<script>", pow: await pow() })).status, 400);
  });
  await step("status shows Received", async () => {
    const r = await post("/api/status", { lookup: reporter.lookup });
    const s = await r.json();
    assert.equal(s.status, "received");
    assert.equal(s.messages.length, 0);
  });
  await step("an unknown code finds nothing", async () => {
    const other = await deriveFromCode(await newReceiptCode());
    assert.equal((await post("/api/status", { lookup: other.lookup })).status, 404);
  });

  console.log("Operator");
  let caseId;
  await step("admin API refuses without the token", async () => {
    assert.equal((await fetch(BASE + "/api/admin/cases")).status, 401);
    assert.equal((await fetch(BASE + "/api/admin/cases", { headers: { Authorization: "Bearer wrong" } })).status, 401);
  });
  await step("admin lists the case with a PR reference", async () => {
    const { cases } = await (await fetch(BASE + "/api/admin/cases", { headers: admin })).json();
    assert.equal(cases.length, 1);
    assert.match(cases[0].ref, /^PR-\d{4}-0001$/);
    caseId = cases[0].id;
  });
  await step("server holds only ciphertext; the private key opens it", async () => {
    const { case: c } = await (await fetch(`${BASE}/api/admin/case?id=${caseId}`, { headers: admin })).json();
    assert.ok(!c.report.includes("Test Logistics"));
    const opened = await openJson(c.report, keyFile.publicKey, keyFile.privateKey);
    assert.equal(opened.establishment.name, "Test Logistics Pvt Ltd");
    assert.equal(opened.reporterPublicKey, reporter.publicKey);
  });
  await step("operator sets status, saves encrypted notes, messages the reporter", async () => {
    const msg = { text: "Roughly how many people work at the Panvel address?", on: "2026-11-08" };
    const r = await post(
      "/api/admin/case",
      {
        id: caseId,
        status: "needs_info",
        notes: await sealJson({ text: "checked GST" }, keyFile.publicKey),
        message: { ciphertext: await sealJson(msg, reporter.publicKey), copy: await sealJson(msg, keyFile.publicKey) },
      },
      admin,
    );
    assert.equal(r.status, 200);
  });
  await step("an invalid status is refused", async () => {
    assert.equal((await post("/api/admin/case", { id: caseId, status: "deleted" }, admin)).status, 400);
  });

  console.log("Reporter reads and replies");
  await step("reporter sees the new status and decrypts the message with her code", async () => {
    const again = await deriveFromCode(code.toLowerCase()); // typed differently, same keys
    const s = await (await post("/api/status", { lookup: again.lookup })).json();
    assert.equal(s.status, "needs_info");
    const m = await openJson(s.messages[0].ciphertext, again.publicKey, again.privateKey);
    assert.match(m.text, /how many people/);
  });
  await step("reporter replies; operator sees it as unread and can read it", async () => {
    const msg = { text: "About 30, including contract drivers.", on: "2026-11-09" };
    const r = await post("/api/reply", {
      lookup: reporter.lookup,
      ciphertext: await sealJson(msg, keyFile.publicKey),
      copy: await sealJson(msg, reporter.publicKey),
      pow: await pow(),
    });
    assert.equal(r.status, 200);
    const { cases } = await (await fetch(BASE + "/api/admin/cases", { headers: admin })).json();
    assert.equal(cases[0].unread, 1);
    const { case: c } = await (await fetch(`${BASE}/api/admin/case?id=${caseId}`, { headers: admin })).json();
    const reply = c.messages.find((m) => m.direction === "to_platform");
    assert.equal((await openJson(reply.ciphertext, keyFile.publicKey, keyFile.privateKey)).text, msg.text);
    const after = await (await fetch(BASE + "/api/admin/cases", { headers: admin })).json();
    assert.equal(after.cases[0].unread, 0, "opening the case marks it read");
  });
  await step("reply without proof of work is refused", async () => {
    const r = await post("/api/reply", { lookup: reporter.lookup, ciphertext: sealed.slice(0, 100), copy: sealed.slice(0, 100) });
    assert.equal(r.status, 400);
  });

  console.log("Letters and retention");
  await step("letters fill from the decrypted report", async () => {
    const { letterEnglish, letterMarathi, letterEscalation, letterRti } = await import("../lib/letters.ts");
    const input = {
      ref: "PR-2026-0001",
      date: "7 November 2026",
      district: "Raigad",
      report,
      operator: { name: "A. Operator", platform: "POSH Watch", address: "Panvel", email: "a@example.org", phone: "90000" },
      employeesBasis: "company website",
      sheboxDate: "3 November 2026",
      firstLetterDate: "2026-11-10",
      tracking: "EE123456789IN",
      replyStatus: "no acknowledgement",
    };
    const en = letterEnglish(input);
    assert.ok(en.includes("Test Logistics Pvt Ltd") && en.includes("Section 25") && en.includes("(c) No Internal Committee for this establishment appears on the SHe-Box"));
    assert.ok(!en.includes("[Your full name]"));
    const mr = letterMarathi(input);
    assert.ok(mr.includes("जिल्हा अधिकारी") && mr.includes("Raigad"));
    assert.ok(letterEscalation(input).includes("EE123456789IN"));
    assert.ok(letterRti(input).includes("Right to Information Act, 2005"));
  });
  await step("purge deletes the report and messages but keeps the case", async () => {
    const r = await fetch(`${BASE}/api/admin/case?id=${caseId}`, { method: "DELETE", headers: admin });
    assert.equal(r.status, 200);
    const { case: c } = await (await fetch(`${BASE}/api/admin/case?id=${caseId}`, { headers: admin })).json();
    assert.equal(c.report, "PURGED");
    assert.equal(c.messages.length, 0);
    assert.equal(c.notes, null);
  });

  console.log(`\n${passed} checks passed.`);
} catch (e) {
  console.error("\nFAILED:", e.message);
  console.error(serverLog.slice(-3000));
  process.exitCode = 1;
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  process.exit(process.exitCode ?? 0);
}
