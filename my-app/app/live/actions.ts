"use server";

/**
 * THE LIVE PARTICIPANT SURFACE — anonymous, no `requireStaff`/`requireAdmin`
 * anywhere in this file. Its safety comes from the room number resolving to
 * an open session, mirroring `app/b/actions.ts`'s reasoning for the async
 * side (PLAN §7.2).
 *
 * NO KEY LOOKUP IN THIS FILE. EVER. It imports `getForReviewer` from
 * `lib/services/questions` and `submitLive` from `lib/services/responses` —
 * never `getWithKey`, `listWithKey`, or `submitAsync`. Nobody on a phone may
 * see an answer key: the host advances the room to `revealed` and the key
 * renders on the presenter screen, the host's own authenticated browser
 * (README, PLAN §5.5/§5.10). This is the file PLAN §7.1 names as the one
 * that must never grow a key lookup — if a future edit adds one, that edit
 * is wrong regardless of how it got here.
 *
 * Errors are RETURN VALUES, not throws (§5.8) — the phone calls these
 * imperatively from `useTransition`, so a thrown error would hit
 * `error.tsx` and lose the phone's place mid-session.
 */

import { asAppError } from "@/lib/errors";
import { submitLiveAnswerInput } from "@/lib/schemas";
import * as questions from "@/lib/services/questions";
import type { ReviewerQuestion } from "@/lib/services/questions";
import * as responses from "@/lib/services/responses";
import type { LiveSubmitResult } from "@/lib/services/responses";
import * as sessions from "@/lib/services/sessions";
import { parseRoomNumber } from "@/lib/services/sessions";
import type { SessionPhase } from "@/lib/services/sessions";

export type ActionError = { ok: false; message: string };

export type JoinRoomResult =
  | {
      ok: true;
      sessionId: string;
      phase: SessionPhase;
      currentQuestion: ReviewerQuestion | null;
    }
  | ActionError;

/**
 * Room numbers display as `VLT-0042`; `/join`'s input tolerates both that
 * and the bare integer, so the parse happens here rather than trusting the
 * client to have normalized it.
 */
export async function joinRoom(
  roomNumber: string,
  participantId: string,
  displayName?: string,
): Promise<JoinRoomResult> {
  try {
    const parsedRoom = parseRoomNumber(roomNumber);
    if (parsedRoom === null) {
      return {
        ok: false,
        message: "That doesn't look like a room number — try VLT-0042 or just 42.",
      };
    }

    const joined = await sessions.resolveRoom({
      roomNumber: parsedRoom,
      participantId,
      displayName,
    });

    // Keyless by type — ReviewerQuestion has no answerKey property to reach
    // for, whatever this file does (§5.10).
    const currentQuestion = joined.currentQuestionId
      ? await questions.getForReviewer(joined.currentQuestionId)
      : null;

    return {
      ok: true,
      sessionId: joined.sessionId,
      phase: joined.phase,
      currentQuestion,
    };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

export async function submitLiveAnswer(
  sessionId: string,
  input: {
    participantId: string;
    questionId: string;
    answer: unknown;
    rationale?: string;
  },
): Promise<LiveSubmitResult | ActionError> {
  try {
    // `responses.submitLive` has no notion of the room's phase — this is
    // what actually stops a submit once voting has moved on to locked,
    // revealed, or the session has ended.
    const phase = await sessions.getPhase(sessionId);
    if (phase !== "voting") {
      return { ok: false, message: "Voting is closed for this question." };
    }

    const parsed = submitLiveAnswerInput.parse({
      ...input,
      liveSessionId: sessionId,
    });
    return await responses.submitLive(parsed);
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
