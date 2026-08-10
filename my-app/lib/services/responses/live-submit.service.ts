import "server-only";

import { isAppError } from "@/lib/errors";
import * as repo from "@/lib/repos/responses";
import type { SubmitLiveAnswerInput } from "@/lib/schemas/responses";
import * as participants from "@/lib/services/participants";

/**
 * THE LIVE WRITE PATH.
 *
 * DO NOT ADD AN ANSWER-KEY IMPORT TO THIS FILE. No `getWithKey`, no
 * `reveal.util`, no `registry[...].grade` — nothing that could produce a key
 * whatever you send it. Nobody on a phone may ever see one; the host
 * advances the room to `revealed` and it renders on the presenter screen,
 * which is the host's own authenticated browser (migration, PLAN §5.5).
 *
 * That is why this is a separate file from `responses.service.ts` rather
 * than a branch inside it: safe because the capability is absent, not
 * because the branch was written the right way round.
 *
 * `live_sessions.response_count` is bumped by the
 * `responses_bump_live_count` trigger, not from here — PostgREST updates
 * carry literal values, so `count = count + 1` cannot be expressed through
 * the query builder and a read-modify-write in TS would lose the race
 * (PLAN §4.4).
 */

export type LiveSubmitResult = { ok: true; alreadyAnswered: boolean };

export async function submitLive(
  input: SubmitLiveAnswerInput,
): Promise<LiveSubmitResult> {
  await participants.ensureParticipant(input.participantId);

  try {
    await repo.insert({
      questionId: input.questionId,
      participantId: input.participantId,
      liveSessionId: input.liveSessionId,
      answer: input.answer,
      rationale: input.rationale ?? null,
    });
  } catch (error) {
    // A duplicate is the expected outcome of a double-tap, not a failure.
    // The phone shows "answered"; results are on the shared screen.
    if (isAppError(error) && error.kind === "conflict") {
      return { ok: true, alreadyAnswered: true };
    }
    throw error;
  }

  return { ok: true, alreadyAnswered: false };
}
