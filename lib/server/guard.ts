// Request checks shared by the API routes. Nothing here logs: on purpose, no
// route writes request details, IP addresses or bodies to the console.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { leadingZeroBits } from "../crypto-core.js";
import { getStore, sha256Hex } from "./store";

export const POW_DIFFICULTY = Number(process.env.POW_DIFFICULTY ?? 15);
const POW_TTL_MS = 15 * 60 * 1000;

// In production POW_SECRET must be set so challenges survive across function instances.
const fallbackSecret = randomBytes(32).toString("hex");
function powSecret() {
  const s = process.env.POW_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1") {
    throw new Error("POW_SECRET is not set");
  }
  return s ?? fallbackSecret;
}

export function issueChallenge() {
  const ts = Date.now().toString(36);
  const rand = randomBytes(12).toString("hex");
  const mac = createHmac("sha256", powSecret()).update(`${ts}.${rand}`).digest("hex").slice(0, 32);
  return { challenge: `${ts}.${rand}.${mac}`, difficulty: POW_DIFFICULTY };
}

/** Verifies a solved challenge and marks it used. */
export async function checkProofOfWork(pow: unknown): Promise<boolean> {
  if (!pow || typeof pow !== "object") return false;
  const { challenge, nonce } = pow as { challenge?: unknown; nonce?: unknown };
  if (typeof challenge !== "string" || typeof nonce !== "string" || nonce.length > 20) return false;
  const parts = challenge.split(".");
  if (parts.length !== 3) return false;
  const [ts, rand, mac] = parts;
  const expected = createHmac("sha256", powSecret()).update(`${ts}.${rand}`).digest("hex").slice(0, 32);
  if (!safeEqual(mac, expected)) return false;
  const issued = parseInt(ts, 36);
  if (!Number.isFinite(issued) || Date.now() - issued > POW_TTL_MS || issued > Date.now() + 60_000) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${challenge}:${nonce}`)));
  if (leadingZeroBits(digest) < POW_DIFFICULTY) return false;
  return getStore().claimChallenge(sha256Hex(challenge));
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** True when the request carries the admin token. */
export function isAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || token.length < 32) return false; // refuse weak or missing tokens outright
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(given, token);
}

export const isLookup = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
export const isCiphertext = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 40 && v.length <= max && /^[A-Za-z0-9+/=]+$/.test(v);

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Reads a JSON body without trusting its size or shape. */
export async function readJson(req: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}
