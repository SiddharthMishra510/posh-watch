"use client";

import { solveProofOfWork } from "./crypto-core.js";

/** Fetches a challenge and solves it; used before every public write. */
export async function getProofOfWork(onProgress?: (n: number) => void) {
  const res = await fetch("/api/pow", { method: "POST" });
  if (!res.ok) throw new Error("pow");
  const { challenge, difficulty } = (await res.json()) as { challenge: string; difficulty: number };
  const nonce = await solveProofOfWork(challenge, difficulty, onProgress);
  return { challenge, nonce };
}

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    referrerPolicy: "no-referrer",
  });
  return res;
}

/**
 * Re-draws an image onto a canvas and exports a JPEG. This drops all metadata
 * (GPS location, camera model, timestamps) and shrinks large photos.
 */
export async function cleanImage(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.8),
  );
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
