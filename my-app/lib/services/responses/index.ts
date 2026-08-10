import "server-only";

/**
 * The public surface (PLAN §5.3).
 *
 * Two submit methods with two different return types, not one method with a
 * branch (§5.5):
 *
 *   submitAsync(input) → { alreadyAnswered, reveal }   loads the key
 *   submitLive(input)  → { ok, alreadyAnswered }       no key, ever
 *
 * `app/live/actions.ts` imports `submitLive` and nothing else from here.
 */

export {
  submitAsync,
  listAnsweredReveals,
  listAnsweredQuestionIds,
  type AsyncSubmitResult,
} from "./responses.service";

export { submitLive, type LiveSubmitResult } from "./live-submit.service";

export type { Reveal } from "./reveal.util";
