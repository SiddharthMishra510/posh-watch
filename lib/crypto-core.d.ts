export function sodium(): Promise<typeof import("libsodium-wrappers")>;
export function newReceiptCode(): Promise<string>;
export function formatCode(raw: string): string;
export function normalizeCode(input: string): string | null;
export function deriveFromCode(
  code: string,
): Promise<{ code: string; lookup: string; publicKey: string; privateKey: Uint8Array }>;
export function sealJson(value: unknown, publicKeyB64: string): Promise<string>;
export function openJson<T = unknown>(
  ciphertextB64: string,
  publicKeyB64: string,
  privateKey: Uint8Array | string,
): Promise<T>;
export function generatePlatformKeys(): Promise<{ publicKey: string; privateKey: string }>;
export function keysMatch(publicKeyB64: string, privateKeyB64: string): Promise<boolean>;
export function leadingZeroBits(bytes: Uint8Array): number;
export function solveProofOfWork(
  challenge: string,
  difficulty: number,
  onProgress?: (tries: number) => void,
): Promise<string>;
