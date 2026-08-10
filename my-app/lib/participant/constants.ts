/**
 * Participant identity — the shared constants (PLAN §5.14).
 *
 * localStorage is the SOURCE OF TRUTH; the cookie is only the transport, so
 * a server-rendered `/b/[token]` can know which questions were drawn and
 * which were answered. The server never assigns an identity, which is what
 * keeps the README's anonymity claim true.
 *
 * No `server-only` and no `"use client"` here: both sides import this file.
 */

export const PARTICIPANT_COOKIE = "violet_pid";
export const PARTICIPANT_STORAGE_KEY = "violet_pid";

/** One year. Long enough that the round trip happens once, ever. */
export const PARTICIPANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Cheap shape check — the value is client-supplied on both paths. */
export function isParticipantId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
