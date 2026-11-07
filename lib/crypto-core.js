// Shared encryption core. Runs in the browser (reporter and admin pages) and in
// Node (key generation and end-to-end tests). The server never imports this file
// and never sees a private key or a receipt code.
//
// Model
// - The platform has one X25519 key pair. The public key ships with the site;
//   the private key stays in a file on the operator's laptop.
// - A reporter gets a random 100-bit receipt code. From it we derive
//   (a) a lookup value the server can index by, and
//   (b) the reporter's own key pair, so the operator can encrypt replies to her.
// - Every report and message is a libsodium sealed box: only the holder of the
//   recipient's private key can open it.

import _sodium from "libsodium-wrappers";

/** @returns {Promise<typeof _sodium>} */
export async function sodium() {
  await _sodium.ready;
  return _sodium;
}

// Crockford base32: no I, L, O, U, so codes are hard to misread or mistype.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 20; // 20 chars x 5 bits = 100 bits

/** A new receipt code such as "7K2Q-M9XD-R4TB-0HVF-3WNP". */
export async function newReceiptCode() {
  const s = await sodium();
  const bytes = s.randombytes_buf(CODE_LENGTH);
  let raw = "";
  for (const b of bytes) raw += ALPHABET[b & 31]; // 256 is a multiple of 32: unbiased
  return formatCode(raw);
}

/** Groups a normalised code into blocks of four for display. */
export function formatCode(raw) {
  return raw.match(/.{1,4}/g).join("-");
}

/**
 * Normalises what a person typed: case, spaces, dashes and look-alike letters.
 * Returns null when it cannot be a valid code.
 */
export function normalizeCode(input) {
  if (typeof input !== "string") return null;
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

function domainHash(s, domain, value) {
  return s.crypto_generichash(32, s.from_string(`posh-watch/v1/${domain}/${value}`));
}

/**
 * Everything a reporter's code unlocks.
 * @returns {Promise<{ code: string, lookup: string, publicKey: string, privateKey: Uint8Array }>}
 */
export async function deriveFromCode(code) {
  const s = await sodium();
  const norm = normalizeCode(code);
  if (!norm) throw new Error("invalid code");
  const lookup = s.to_hex(domainHash(s, "lookup", norm));
  const kp = s.crypto_box_seed_keypair(domainHash(s, "seed", norm));
  return { code: formatCode(norm), lookup, publicKey: toB64(s, kp.publicKey), privateKey: kp.privateKey };
}

function toB64(s, bytes) {
  return s.to_base64(bytes, s.base64_variants.ORIGINAL);
}
function fromB64(s, text) {
  return s.from_base64(text, s.base64_variants.ORIGINAL);
}

/** Encrypts a JSON value so only the holder of `publicKeyB64`'s private key can read it. */
export async function sealJson(value, publicKeyB64) {
  const s = await sodium();
  const sealed = s.crypto_box_seal(s.from_string(JSON.stringify(value)), fromB64(s, publicKeyB64));
  return toB64(s, sealed);
}

/** Opens a sealed box. `privateKey` may be bytes or base64. */
export async function openJson(ciphertextB64, publicKeyB64, privateKey) {
  const s = await sodium();
  const sk = typeof privateKey === "string" ? fromB64(s, privateKey) : privateKey;
  const plain = s.crypto_box_seal_open(fromB64(s, ciphertextB64), fromB64(s, publicKeyB64), sk);
  return JSON.parse(s.to_string(plain));
}

/** A new platform key pair, both halves base64. */
export async function generatePlatformKeys() {
  const s = await sodium();
  const kp = s.crypto_box_keypair();
  return { publicKey: toB64(s, kp.publicKey), privateKey: toB64(s, kp.privateKey) };
}

/** Checks that a private key matches a public key, without decrypting anything real. */
export async function keysMatch(publicKeyB64, privateKeyB64) {
  try {
    const probe = await sealJson({ probe: true }, publicKeyB64);
    const out = await openJson(probe, publicKeyB64, privateKeyB64);
    return out.probe === true;
  } catch {
    return false;
  }
}

// ---- Proof of work -----------------------------------------------------------
// Instead of logging IP addresses to stop spam, each submission must carry a
// small proof of work (a few seconds of hashing in the browser).

/** Number of leading zero bits in a byte array. */
export function leadingZeroBits(bytes) {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(b) - 24;
    break;
  }
  return bits;
}

/**
 * Finds a nonce for a challenge using Web Crypto (browser or Node 20+).
 * @param {(tries: number) => void} [onProgress]
 */
export async function solveProofOfWork(challenge, difficulty, onProgress) {
  const enc = new TextEncoder();
  for (let nonce = 0; ; nonce++) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`${challenge}:${nonce}`)));
    if (leadingZeroBits(digest) >= difficulty) return String(nonce);
    if (onProgress && nonce % 5000 === 0) onProgress(nonce);
  }
}
