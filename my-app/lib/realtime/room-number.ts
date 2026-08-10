/**
 * Pure, client-safe, no server imports — which is why it lives in the live
 * lane (`lib/realtime`, PLAN §5.16) rather than in `lib/services/sessions`.
 * It used to sit there and be imported past the server-only barrel by four
 * client files; that documented Wave 3 exception is gone, and both sides now
 * import this module the same way. Nothing here may grow a `server-only`
 * dependency: `/join`'s form, the phone shell, the presenter shell and the
 * host controls all import it into the browser bundle.
 *
 * `room_number` is stored as the bare integer identity column (migration);
 * `VLT-0042` is a display choice, same as the batch token's URL — changing
 * the prefix later should be a string change here, not a backfill (migration
 * comment).
 *
 * `/join` "tolerates both forms" (PLAN §9 F5): a participant may type
 * `VLT-0042`, `vlt-42`, or just `42`.
 *
 * `lib/services/sessions/index.ts` re-exports both functions, for server
 * callers already importing the rest of that folder from there.
 */

const PREFIX = "VLT";

export function formatRoomNumber(roomNumber: number): string {
  return `${PREFIX}-${String(roomNumber).padStart(4, "0")}`;
}

/** `null` on anything that isn't a positive integer, prefixed or not. */
export function parseRoomNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(/^vlt[\s-]?/i, "");
  const digits = withoutPrefix.replace(/\D/g, "");
  if (!digits) return null;

  const value = Number.parseInt(digits, 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
