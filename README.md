# POSH Watch Maharashtra

An anonymous reporting site for Maharashtra workplaces with 10 or more employees that have no Internal Committee under the POSH Act, 2013. Reports are encrypted in the reporter's browser; the operator decrypts them on their own laptop, checks the facts, and writes to the District Officer asking for an inspection under Section 25.

Next.js 16 on Vercel, Neon Postgres, libsodium. English, Marathi and Hindi.

## How the privacy works

| Who | Sees |
| --- | --- |
| Reporter's browser | Everything she types, her receipt code |
| Vercel (hosting) | Her IP address at the edge; request logs kept 1 hour on Hobby. Never the report's contents |
| Database | Ciphertext, a hash of a value derived from the receipt code, a status, dates. No times of day, no IPs |
| Operator's browser, with `platform-key.json` | The decrypted report, notes and messages |

- **Reports** are libsodium sealed boxes to the platform public key.
- **The receipt code** (100 random bits, shown once) never leaves her device. From it the browser derives a lookup value (sent to the server) and a key pair (so the operator can encrypt replies only she can read).
- **Spam** is limited by a proof of work (about a second of hashing) instead of IP logging or third-party CAPTCHAs.
- **Photos** are redrawn on a canvas before encryption, which strips GPS and camera metadata.
- **No cookies, analytics, external fonts or scripts.** A per-request nonce CSP blocks injected scripts and inline styles.

Limits to be honest about: Vercel sees IP addresses (Tor Browser avoids this); whoever controls the deployed code could change it to capture data before encryption; anyone holding the receipt code can read the thread.

## Deploy (about 30 minutes)

1. **Make the keys, on your laptop.**
   ```bash
   npm install
   npm run keys
   ```
   This writes `platform-key.json` (the private key) and prints three values. Keep `platform-key.json` off the server and out of git, and keep an offline backup. **Losing it means losing every report; leaking it exposes every report.**

2. **Push to GitHub** (a private repository under your personal account; Vercel's Hobby plan cannot import from a GitHub organisation).

3. **Import into Vercel.** New Project → your repo → Deploy. The first deploy will fail until step 5; that is expected.

4. **Add the database.** Project → Storage → Create → Neon (Postgres) → connect to the project. This sets `DATABASE_URL`. Then, on your laptop, with the value copied from Vercel:
   ```bash
   DATABASE_URL="postgres://..." npm run db:init
   ```

5. **Set environment variables** (Project → Settings → Environment Variables), then redeploy:
   - `NEXT_PUBLIC_PLATFORM_PUBLIC_KEY`, `ADMIN_TOKEN`, `POW_SECRET` from step 1
   - `NEXT_PUBLIC_SITE_NAME` (your platform's name)
   - `NEXT_PUBLIC_CONTACT_EMAIL` (a mailbox only you read)

6. **Turn things off in Vercel:** Web Analytics and Speed Insights off; leave Log Drains unconfigured.

7. **Smoke test** on the live site: submit a test report from your phone, unlock `/admin` with the token and key file, send a message, read it back with the receipt code. Then delete the test case's data with "Delete report data" after closing it.

## Run locally

```bash
cp .env.example .env.local   # fill in values from `npm run keys`; leave DATABASE_URL empty
npm run dev                  # http://localhost:3000 (in-memory store, lost on restart)
```

Tests (need `platform-key.json` from `npm run keys`):
```bash
npm run build && npm run test:e2e   # 32 checks: pages, CSP, encryption round trip, proof of work, admin, retention
```

## Operating it

- **Back office:** `/admin`. Unlock with the admin token and `platform-key.json`. Nothing is stored in the browser except your letter signature details.
- **Every case:** tick checks 1 to 5 before filing; generate the letter (English and Marathi), print, sign, send by email and speed post; set the status to *Filed* and the date sent. The case list flags **Escalate** at 30 days and **RTI due** at 45.
- **Retention:** 90 days after closing a case, use *Delete report data*.
- **Rotating the admin token:** change `ADMIN_TOKEN` in Vercel and redeploy. Rotating the platform key means old reports can only be read with the old key file.
- **Templates and contacts:** the letters in `lib/letters.ts` mirror the POSH Reporting Toolkit doc. Put your lawyer's corrections in both.

## Before public launch

- [ ] Lawyer reviews the letters, `lib/i18n/*` privacy and terms text, and the declaration.
- [ ] A native speaker reviews the Marathi (`lib/i18n/mr.ts`, `lib/letters.ts`) and Hindi (`lib/i18n/hi.ts`). Then remove the "draft translation" footer line in each.
- [ ] Check that Tor Browser can reach the site (Vercel's firewall sometimes challenges Tor exits).
- [ ] Recheck Vercel's Hobby plan terms (personal, non-commercial use) once the project receives grants or pays anyone.

## Files

| Path | What it is |
| --- | --- |
| `lib/crypto-core.js` | All encryption: receipt codes, key derivation, sealed boxes, proof of work |
| `components/ReportForm.tsx` | The report form; encrypts before sending |
| `components/StatusChecker.tsx` | Status, messages and replies, unlocked by the receipt code |
| `components/admin/AdminApp.tsx` | Back office: decrypt, checklist, letters, messages, retention |
| `lib/letters.ts` | Letter templates (English, Marathi, escalation, RTI) |
| `lib/i18n/` | All public text in English, Marathi and Hindi |
| `app/api/` | Six small routes; none of them log |
| `lib/server/store.ts` | Neon storage, plus an in-memory store for development |
| `proxy.ts`, `next.config.ts` | CSP nonce and security headers |
| `db/schema.sql` | Three tables |
