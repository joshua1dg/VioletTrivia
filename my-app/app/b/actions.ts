"use server";

import { asAppError } from "@/lib/errors";
import {
  registerParticipantInput,
  submitAnswerInput,
} from "@/lib/schemas";
import * as participants from "@/lib/services/participants";
import * as responses from "@/lib/services/responses";
import type { Reveal } from "@/lib/services/responses";

/**
 * The async participant surface — the ONE anonymous action module.
 *
 * It calls no `require*()` guard, because this surface has no auth. Its
 * safety comes from the batch token and from `submitAsync` refusing a
 * question outside the participant's draw (PLAN §7.2).
 *
 * ERRORS ARE RETURN VALUES, NOT THROWS. A thrown error in an action hits
 * `error.tsx` and the participant loses whatever they typed; `useActionState`
 * renders a returned one in place. Every catch here ends in
 * `asAppError(e).userMessage`, which is never a raw Postgres string (§5.8).
 *
 * Each function is: parse input → one service call → map the result. No
 * business logic — if one grows past about fifteen lines, logic has leaked
 * in (§5.5).
 */

export type ActionError = { ok: false; message: string };

/* ------------------------------------------------------------------ *
 * registerParticipant
 *
 * Called imperatively from the cookie-bootstrap component (F4), not from a
 * form — so it takes a plain object rather than `(prevState, formData)`.
 * Wrap it in `useTransition` and read `isPending` from the transition
 * (PLAN §7.1).
 * ------------------------------------------------------------------ */

export type RegisterParticipantResult = { ok: true; id: string } | ActionError;

export async function registerParticipant(input: {
  participantId: string;
  batchToken?: string;
  displayName?: string;
}): Promise<RegisterParticipantResult> {
  try {
    const parsed = registerParticipantInput.parse(input);
    const participant = await participants.registerParticipant(parsed);
    return { ok: true, id: participant.id };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}

/* ------------------------------------------------------------------ *
 * submitAsyncAnswer
 *
 * Shaped for React 19 `useActionState`: `(prevState, payload)`, previous
 * state first. The payload is a plain object rather than `FormData` because
 * an answer is structured (`{ order: ['b','c','a','d'] }`) and the review
 * components hand it back through `onAnswer`, not through form fields:
 *
 *   const [state, submit, pending] = useActionState(submitAsyncAnswer, null)
 *   startTransition(() => submit({ participantId, questionId, batchToken,
 *                                  answer, rationale }))
 *
 * `alreadyAnswered` is always present on success. It is TRUE on a refresh,
 * a double-tap or a back button — the expected outcome, and it comes back
 * WITH the reveal. Render it as "You've already answered this," never as an
 * error (§5.8, §6).
 * ------------------------------------------------------------------ */

export type SubmitAsyncAnswerResult =
  | { ok: true; alreadyAnswered: boolean; reveal: Reveal }
  | ActionError;

export async function submitAsyncAnswer(
  _previousState: SubmitAsyncAnswerResult | null,
  payload: unknown,
): Promise<SubmitAsyncAnswerResult> {
  try {
    const input = submitAnswerInput.parse(payload);
    const { alreadyAnswered, reveal } = await responses.submitAsync(input);
    return { ok: true, alreadyAnswered, reveal };
  } catch (error) {
    return { ok: false, message: asAppError(error).userMessage };
  }
}
