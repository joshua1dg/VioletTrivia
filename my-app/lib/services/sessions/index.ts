import "server-only";

/**
 * The public surface (PLAN §5.3). Nothing outside this folder imports
 * `sessions.service.ts` directly.
 *
 * `app/admin/sessions/**` imports the host-side surface. `app/live/actions.ts`
 * imports ONLY `resolveRoom` and `getPhase` — both anonymous, neither one
 * capable of returning an answer key (§5.5, §5.10). `app/present/[id]`
 * imports `getTally`, which is staff-gated and the one place in this folder
 * that loads a key.
 */

export {
  // host mutations
  startSession,
  advance,
  setPhase,
  endSession,
  forceEndMine,
  // host reads
  getById,
  listOpenSessions,
  getMyOpenSession,
  listStartableBatches,
  getTally,
  // anonymous — the live participant surface
  resolveRoom,
  roomIsOpen,
  getPhase,
  listAnswersForTally,
  hasAnswered,
  type SessionPhase,
  type LiveSession,
  type StartableBatch,
  type RoomView,
  type PresenterTally,
} from "./sessions.service";

// Room-number formatting/parsing is pure and client-safe, so it lives in
// the live lane (`@/lib/realtime/room-number`) and every client component
// imports it from there. Re-exported here purely as a convenience for
// server callers already importing the rest of this folder from this file.
export { formatRoomNumber, parseRoomNumber } from "@/lib/realtime/room-number";
