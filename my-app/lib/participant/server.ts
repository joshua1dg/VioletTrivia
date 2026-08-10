import "server-only";

import { cookies } from "next/headers";

import { PARTICIPANT_COOKIE, isParticipantId } from "./constants";

/**
 * The server half of the participant bootstrap (PLAN §5.14).
 *
 * `/b/[token]` reads the cookie. Absent → it renders the client bootstrap,
 * which reads localStorage (or generates a uuid), mirrors it to the cookie
 * and calls `router.refresh()`. Present → the page renders normally. One
 * extra round trip on the very first visit, never again.
 *
 * `cookies()` is ASYNC in Next 16, hence the await.
 */
export async function readParticipantId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(PARTICIPANT_COOKIE)?.value;
  return isParticipantId(value) ? value : null;
}
