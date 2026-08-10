"use client";

import {
  PARTICIPANT_COOKIE,
  PARTICIPANT_COOKIE_MAX_AGE,
  PARTICIPANT_STORAGE_KEY,
  isParticipantId,
} from "./constants";

/**
 * The browser half of the participant bootstrap (PLAN §5.14).
 *
 * This is LOGIC, not a component: F4 owns `app/b/**` and writes the little
 * client component that calls `bootstrapParticipantId()` in an effect and
 * then `router.refresh()`. It lives here so the cookie name, the storage key
 * and the uuid rules have exactly one definition.
 *
 * `"use client"` is on the module because everything in it touches `window`
 * — importing it from a Server Component should be a build error, not a
 * runtime one.
 */

/** localStorage is the source of truth. Generates an id the first time. */
export function ensureParticipantId(): string {
  const existing = readStored();
  if (existing) return existing;

  const id = crypto.randomUUID();
  try {
    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, id);
  } catch {
    // Private mode, or storage disabled. The cookie below still carries the
    // id for this session; the participant simply gets a new one next time.
  }
  return id;
}

export function readStored(): string | null {
  try {
    const value = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
    return isParticipantId(value) ? value : null;
  } catch {
    return null;
  }
}

export function readParticipantCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${PARTICIPANT_COOKIE}=`));
  const value = match?.slice(PARTICIPANT_COOKIE.length + 1);
  return isParticipantId(value) ? value : null;
}

/** The transport half: mirror the id where the server can read it. */
export function writeParticipantCookie(id: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${PARTICIPANT_COOKIE}=${id}; Path=/; Max-Age=${PARTICIPANT_COOKIE_MAX_AGE}` +
    `; SameSite=Lax${secure}`;
}

/**
 * The whole bootstrap, in one call.
 *
 * `cookieWasMissing` is what tells the caller a `router.refresh()` is needed
 * — the server rendered this page without an identity and needs to be asked
 * again now that there is one.
 */
export function bootstrapParticipantId(): {
  id: string;
  cookieWasMissing: boolean;
} {
  const id = ensureParticipantId();
  const cookieWasMissing = readParticipantCookie() !== id;
  if (cookieWasMissing) writeParticipantCookie(id);
  return { id, cookieWasMissing };
}
