import "server-only";

import { requireStaff } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import * as repo from "@/lib/repos/sessions";
import type { LiveSessionRow, SessionPhase } from "@/lib/repos/sessions";
import * as batches from "@/lib/services/batches";
import type { BatchWithCounts } from "@/lib/services/batches";
import * as participants from "@/lib/services/participants";
import * as questions from "@/lib/services/questions";
import { registry, type QuestionTemplate } from "@/lib/templates/registry";
import type { Answer, TallyGroup, TemplateKey } from "@/lib/templates/types";

export type { SessionPhase, LiveSessionRow as LiveSession };
export type { BatchWithCounts as StartableBatch };

/**
 * The public surface (PLAN §5.3). Authorization lives here, not in
 * `app/admin/sessions/actions.ts` — a Server Action is a public endpoint,
 * and not rendering the form protects nothing (§7.2). `resolveRoom` and
 * `getPhase` are the two exceptions: the live participant surface has no
 * auth at all (mirrors `app/b/actions.ts`'s reasoning), so their safety
 * comes from the room number resolving to an open session and from
 * `submitLiveAnswer` checking `getPhase` before every write.
 */

/* ------------------------------------------------------------------ *
 * Host mutations — requireStaff (admin ⊃ host; both roles run sessions)
 * ------------------------------------------------------------------ */

export async function startSession(
  batchId: string,
  /** Optional per-question timer; null/undefined = untimed. */
  votingSeconds?: number | null,
): Promise<{ sessionId: string; roomNumber: number }> {
  const staff = await requireStaff();

  // Confirms the batch exists (throws not_found otherwise) before checking
  // it has anything to run — an empty batch is a distinct, friendlier error.
  await batches.getById(batchId);
  const questionIds = await batches.getQuestionIds(batchId);
  if (questionIds.length === 0) {
    throw new AppError(
      "validation",
      "This batch has no questions yet — add some before starting a session.",
    );
  }

  // The partial unique index `live_sessions_one_open_per_host` is what
  // actually enforces one-open-session-per-host; a second attempt surfaces
  // as AppError("conflict") from the repo with a message pointing at
  // force-end (PLAN §9's "enforce ... starting while one is open → AppError
  // conflict with a message pointing at force-end").
  const session = await repo.insert({
    batchId,
    hostId: staff.userId,
    votingSeconds: votingSeconds ?? null,
  });
  return { sessionId: session.id, roomNumber: session.roomNumber };
}

/** now + the session's timer, or null on an untimed session. */
function votingDeadline(votingSeconds: number | null): string | null {
  return votingSeconds
    ? new Date(Date.now() + votingSeconds * 1000).toISOString()
    : null;
}

/** Next question in the batch's `position` order; phase → voting;
 * `response_count` → 0 (a plain update — the trigger only increments, §4.4). */
export async function advance(sessionId: string): Promise<LiveSessionRow> {
  await requireStaff();

  const session = await repo.getById(sessionId);
  const questionIds = await batches.getQuestionIds(session.batchId);
  const nextPosition =
    session.currentPosition === null ? 0 : session.currentPosition + 1;

  if (nextPosition >= questionIds.length) {
    throw new AppError(
      "validation",
      "That was the last question in this batch.",
    );
  }

  return repo.update(sessionId, {
    currentQuestionId: questionIds[nextPosition],
    currentPosition: nextPosition,
    phase: "voting",
    responseCount: 0,
    votingEndsAt: votingDeadline(session.votingSeconds),
  });
}

/** lobby | voting | locked | revealed. `ended` goes through `endSession`
 * instead, since ending also stamps `ended_at`.
 *
 * Re-entering `voting` restarts the timer (a fresh deadline from the
 * session's `voting_seconds`); every other phase clears it, so no screen is
 * ever counting down toward a phase that already changed. */
export async function setPhase(
  sessionId: string,
  phase: Exclude<SessionPhase, "ended">,
): Promise<LiveSessionRow> {
  await requireStaff();
  const session = await repo.getById(sessionId);
  return repo.update(sessionId, {
    phase,
    votingEndsAt:
      phase === "voting" ? votingDeadline(session.votingSeconds) : null,
  });
}

export async function endSession(sessionId: string): Promise<void> {
  await requireStaff();
  await repo.update(sessionId, {
    phase: "ended",
    endedAt: new Date().toISOString(),
  });
}

/** Ends the CALLER's own open session, if they have one. Not finding one is
 * not an error — the control is offered unconditionally on the list screen,
 * and clicking it with nothing open is a no-op, not a failure. */
export async function forceEndMine(): Promise<void> {
  const staff = await requireStaff();
  const open = await repo.getOpenByHost(staff.userId);
  if (!open) return;
  await repo.update(open.id, {
    phase: "ended",
    endedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * Host reads — requireStaff
 * ------------------------------------------------------------------ */

export async function getById(sessionId: string): Promise<LiveSessionRow> {
  await requireStaff();
  return repo.getById(sessionId);
}

export async function listOpenSessions(): Promise<LiveSessionRow[]> {
  await requireStaff();
  return repo.listOpen();
}

/** The caller's own open session, or null — for the list screen's
 * "you have one open" banner and to gate the start form. */
export async function getMyOpenSession(): Promise<LiveSessionRow | null> {
  const staff = await requireStaff();
  return repo.getOpenByHost(staff.userId);
}

/**
 * F3's `lib/services/batches` shipped `listBatches()` (with question/response
 * counts) in this same wave, so the start-session form uses that directly
 * rather than a second, narrower read of the same table. Re-exported here so
 * `app/admin/sessions/**` only ever imports from `lib/services/sessions`.
 */
export async function listStartableBatches(): Promise<BatchWithCounts[]> {
  await requireStaff();
  return batches.listBatches();
}

/**
 * The presenter-only tally read (§7.3, §7.1: "no tally endpoint"). Loads the
 * key via `questions.getWithKey` — safe here because this whole function is
 * `requireStaff()`-gated and only ever called from `app/present/[id]`'s
 * Server Component, never from `app/live/**`.
 *
 * `null` groups means "nothing to distribute" — either the template is
 * `write_feedback` (registry `tally` is `null`) or there is no current
 * question yet. Callers must branch on that rather than render an empty bar.
 */
export type PresenterTally = {
  groups: TallyGroup[] | null;
  answerCount: number;
};

export async function getTally(
  sessionId: string,
  questionId: string,
): Promise<PresenterTally> {
  await requireStaff();

  const [question, answers] = await Promise.all([
    questions.getWithKey(questionId),
    repo.listAnswersForTally(sessionId, questionId),
  ]);

  const template = templateFor(question.template);
  const groups = template.tally
    ? template.tally(answers, question.content, question.answerKey)
    : null;

  return { groups, answerCount: answers.length };
}

/**
 * One cast at the boundary where a runtime `template` string meets the
 * static registry union — the same shape `lib/services/questions/hydrate.util.ts`
 * documents. `tally`'s `content`/`answerKey` parameters are typed `unknown`
 * here, so any concrete `HydratedContent<T>`/`AnswerKeyOf<T>` the caller
 * passes in is accepted; the runtime function is still the exact zod-backed
 * one the registry authored for that template.
 */
function templateFor(
  key: TemplateKey,
): QuestionTemplate<unknown, unknown, unknown> {
  return registry[key] as unknown as QuestionTemplate<unknown, unknown, unknown>;
}

/* ------------------------------------------------------------------ *
 * Anonymous — the live participant surface. No requireStaff, mirroring
 * `app/b/actions.ts`'s reasoning: no accounts on this side at all.
 * ------------------------------------------------------------------ */

export type RoomView = {
  sessionId: string;
  phase: SessionPhase;
  currentQuestionId: string | null;
  votingEndsAt: string | null;
};

/**
 * Resolves a room number to its open session, and idempotently records the
 * participant as having passed through it. Called from BOTH `app/live/actions.ts`'s
 * `joinRoom` (with a display name, from `/join`) AND `/live/[room]`'s Server
 * Component on every render (no display name — a reload or a direct link
 * must not lose the one already on file, and `registerParticipant`/
 * `logParticipant` are both upserts, so calling this twice is harmless).
 */
export async function resolveRoom(input: {
  roomNumber: number;
  participantId: string;
  displayName?: string;
}): Promise<RoomView> {
  const session = await repo.getOpenByRoomNumber(input.roomNumber);
  if (!session) {
    throw new AppError(
      "not_found",
      "That room number doesn't match an open session.",
    );
  }

  await participants.registerParticipant({
    participantId: input.participantId,
    displayName: input.displayName,
  });
  await repo.logParticipant(session.id, input.participantId);

  return {
    sessionId: session.id,
    phase: session.phase,
    currentQuestionId: session.currentQuestionId,
    votingEndsAt: session.votingEndsAt,
  };
}

/**
 * Does this room number have a session that hasn't ended? Anonymous, and
 * deliberately narrower than `resolveRoom`: it registers nobody and returns
 * no session id, so `/live/[room]`'s Server Component can answer "that room
 * isn't running" BEFORE it asks the browser for a participant identity.
 * Without it a wrong room number sits on the bootstrap's "Joining…" shell,
 * because the room is only checked after the cookie exists.
 */
export async function roomIsOpen(roomNumber: number): Promise<boolean> {
  return (await repo.getOpenByRoomNumber(roomNumber)) !== null;
}

/**
 * The one read `app/live/actions.ts`'s `submitLiveAnswer` needs before it
 * writes: the registry state machine doesn't stop a submit by itself
 * (`responses.submitLive` has no notion of phase), so this is the guard
 * that keeps a phone from voting once the room has moved past `voting` —
 * or, on a timed session, past the `voting_ends_at` deadline.
 */
export function getPhase(
  sessionId: string,
): Promise<{ phase: SessionPhase; votingEndsAt: string | null }> {
  return repo.getPhase(sessionId);
}

/** Re-exported for the presenter/host tally helper and for anything that
 * needs the raw answers without the grading step. */
export function listAnswersForTally(
  sessionId: string,
  questionId: string,
): Promise<Answer[]> {
  return repo.listAnswersForTally(sessionId, questionId);
}

/** The phone's own resume check — has THIS participant already answered
 * the current question. No requireStaff: called from `/live/[room]`'s
 * Server Component on every render. */
export function hasAnswered(
  sessionId: string,
  questionId: string,
  participantId: string,
): Promise<boolean> {
  return repo.hasAnswered(sessionId, questionId, participantId);
}
