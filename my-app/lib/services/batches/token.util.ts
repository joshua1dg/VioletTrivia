/**
 * Batch access tokens (PLAN §9 F3 / migration comment on `batches.token`:
 * "Use >= 10 URL-safe chars; this token is the only thing gating access.").
 *
 * 16 characters from a 62-symbol alphabet is ~95 bits of entropy — not
 * guessable, comfortably over the 10-char floor, and still short enough to
 * sit in a `/b/{token}` URL without wrapping.
 *
 * Pure and dependency-free, same shape as `draw.util.ts` — no
 * `import "server-only"` here, so nothing stops it being unit-tested or
 * imported in isolation. It just never gets called from anywhere but
 * `batches.service.ts`, which IS server-only and is the only thing that
 * needs a fresh token (on create).
 *
 * Uses the Web Crypto API (`crypto.getRandomValues`), not `node:crypto`:
 * Web Crypto is the one RNG available in every runtime a Next Server Action
 * can execute in (Node or Edge), and this file has no reason to force a
 * Node-only dependency on a caller that doesn't need one.
 */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateToken(length = 16): string {
  if (length < 10) {
    // Not user input — this only ever fires from a hardcoded call site, so
    // it's a thrown Error (a bug to fix), not an AppError (a user mistake).
    throw new Error("Batch tokens must be at least 10 characters.");
  }

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
