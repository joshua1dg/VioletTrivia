import "server-only";

import { serviceClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/database.types";
import { answer as answerSchema } from "@/lib/templates/common";
import type { Answer } from "@/lib/templates/types";

import { camelRow, mapPostgrestError, unwrap, unwrapMaybe } from "./_shared";

/**
 * `live_sessions` + `session_participants` — the live "remote control"
 * (README, PLAN §9 F5). Follows the pattern in `_shared.ts`: one PostgREST
 * query per method, snake→camel here only, no business logic, no auth.
 *
 * No jsonb on either table, so nothing to parse and nothing to soft-fail —
 * same as `lib/repos/batches.ts`.
 */

export type SessionPhase = Database["public"]["Enums"]["session_phase"];

export type LiveSessionRow = {
  id: string;
  batchId: string;
  roomNumber: number;
  currentQuestionId: string | null;
  currentPosition: number | null;
  phase: SessionPhase;
  hostId: string | null;
  responseCount: number;
  votingSeconds: number | null;
  votingEndsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

const COLUMNS =
  "id, batch_id, room_number, current_question_id, current_position, phase, host_id, response_count, voting_seconds, voting_ends_at, started_at, ended_at";

const CONFLICT_MESSAGE =
  "You already have an open session — force-end it before starting another.";

export async function insert(input: {
  batchId: string;
  hostId: string;
  votingSeconds: number | null;
}): Promise<LiveSessionRow> {
  const row = unwrap(
    await serviceClient()
      .from("live_sessions")
      .insert({
        batch_id: input.batchId,
        host_id: input.hostId,
        phase: "lobby",
        voting_seconds: input.votingSeconds,
        started_at: new Date().toISOString(),
      })
      .select(COLUMNS)
      .single(),
    // `live_sessions_one_open_per_host` is the partial unique index that
    // actually enforces "one open session per host" — a second insert while
    // one is still open raises 23505 here.
    { conflict: CONFLICT_MESSAGE },
  );
  return camelRow(row);
}

export async function getById(id: string): Promise<LiveSessionRow> {
  const row = unwrap(
    await serviceClient()
      .from("live_sessions")
      .select(COLUMNS)
      .eq("id", id)
      .single(),
    { notFound: "That session no longer exists." },
  );
  return camelRow(row);
}

/** Only used by the live submit-guard (`app/live/actions.ts`) — cheap enough
 * to select just the two columns the guard reads rather than the whole row. */
export async function getPhase(
  id: string,
): Promise<{ phase: SessionPhase; votingEndsAt: string | null }> {
  const row = unwrap(
    await serviceClient()
      .from("live_sessions")
      .select("phase, voting_ends_at")
      .eq("id", id)
      .single(),
    { notFound: "That session no longer exists." },
  );
  return { phase: row.phase, votingEndsAt: row.voting_ends_at };
}

/** `/join` and `/live/[room]`. Open sessions only — a room number that
 * belongs to an ended session resolves to nothing, same as an unknown one. */
export async function getOpenByRoomNumber(
  roomNumber: number,
): Promise<LiveSessionRow | null> {
  const row = unwrapMaybe(
    await serviceClient()
      .from("live_sessions")
      .select(COLUMNS)
      .eq("room_number", roomNumber)
      .neq("phase", "ended")
      .maybeSingle(),
  );
  return row ? camelRow(row) : null;
}

/** The one-open-session-per-host check, and `forceEndMine`'s target. */
export async function getOpenByHost(
  hostId: string,
): Promise<LiveSessionRow | null> {
  const row = unwrapMaybe(
    await serviceClient()
      .from("live_sessions")
      .select(COLUMNS)
      .eq("host_id", hostId)
      .neq("phase", "ended")
      .maybeSingle(),
  );
  return row ? camelRow(row) : null;
}

/** The sessions list screen — every session not yet ended, most recent host
 * activity first. Small table; no pagination needed at this scale. */
export async function listOpen(): Promise<LiveSessionRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("live_sessions")
      .select(COLUMNS)
      .neq("phase", "ended")
      .order("started_at", { ascending: false }),
  );
  return rows.map(camelRow);
}

export type LiveSessionPatch = {
  phase?: SessionPhase;
  currentQuestionId?: string | null;
  currentPosition?: number | null;
  responseCount?: number;
  votingEndsAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

/** `advance`/`setPhase`/`endSession` all reduce to this one plain update —
 * only `response_count`'s INCREMENT is a trigger's job (§4.4); resetting it
 * to 0 here is a literal value, which PostgREST can express. */
export async function update(
  id: string,
  patch: LiveSessionPatch,
): Promise<LiveSessionRow> {
  const payload: Database["public"]["Tables"]["live_sessions"]["Update"] = {};
  if (patch.phase !== undefined) payload.phase = patch.phase;
  if (patch.currentQuestionId !== undefined)
    payload.current_question_id = patch.currentQuestionId;
  if (patch.currentPosition !== undefined)
    payload.current_position = patch.currentPosition;
  if (patch.responseCount !== undefined)
    payload.response_count = patch.responseCount;
  if (patch.votingEndsAt !== undefined)
    payload.voting_ends_at = patch.votingEndsAt;
  if (patch.startedAt !== undefined) payload.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) payload.ended_at = patch.endedAt;

  const row = unwrap(
    await serviceClient()
      .from("live_sessions")
      .update(payload)
      .eq("id", id)
      .select(COLUMNS)
      .single(),
    { notFound: "That session no longer exists.", conflict: CONFLICT_MESSAGE },
  );
  return camelRow(row);
}

/**
 * Append-only join log (README — "who passed through the room", not a live
 * roster; the live headcount is Presence, not this table). Idempotent: a
 * phone that lands on `/live/[room]` more than once (a reload, or arriving
 * without going through `/join` first) must not error on the primary key.
 */
export async function logParticipant(
  liveSessionId: string,
  participantId: string,
): Promise<void> {
  const result = await serviceClient()
    .from("session_participants")
    .upsert(
      { live_session_id: liveSessionId, participant_id: participantId },
      { onConflict: "live_session_id,participant_id", ignoreDuplicates: true },
    );
  if (result.error) throw mapPostgrestError(result.error);
}

/* ------------------------------------------------------------------ *
 * Two ownership carve-outs, both commented at the call site rather than
 * hidden — this repo reaches into two tables it does not otherwise own.
 * ------------------------------------------------------------------ */

/**
 * OWNERSHIP NOTE (PLAN §9 F5): `responses` belongs to B1/`lib/repos/responses.ts`,
 * not this file, but both reads below are session-shaped data —
 * `where live_session_id = X and question_id = Y[, and participant_id = Z]`
 * — and the plan's own guidance for this exact gap is "your sessions repo
 * may query the `responses` table for live-session tallies directly."
 * `lib/services/responses` is read-only to this agent and exposes no
 * live-session-scoped read at all, so this is that carve-out, not a
 * layering violation nobody noticed.
 *
 * `listAnswersForTally` is presenter-only (§7.1: no tally endpoint, no phone
 * ever calls this) — `registry[t].tally(answers, content, answerKey)` is
 * computed from its result, server-side, in the presenter's own Server
 * Component. `hasAnswered` is the phone's own resume check: whether ITS OWN
 * participant has already answered the current question, so a reload
 * during `voting` shows "you're in" instead of a blank form it would just
 * bounce off `responses_dedupe` a moment later anyway.
 */
export async function listAnswersForTally(
  sessionId: string,
  questionId: string,
): Promise<Answer[]> {
  const rows = unwrap(
    await serviceClient()
      .from("responses")
      .select("id, answer")
      .eq("live_session_id", sessionId)
      .eq("question_id", questionId),
  );

  return rows.flatMap((row) => {
    const result = answerSchema.safeParse(row.answer);
    if (!result.success) {
      console.error(
        `[sessions] skipping unparseable answer on response ${row.id} for the presenter tally`,
      );
      return [];
    }
    return [result.data];
  });
}

export async function hasAnswered(
  sessionId: string,
  questionId: string,
  participantId: string,
): Promise<boolean> {
  const row = unwrapMaybe(
    await serviceClient()
      .from("responses")
      .select("id")
      .eq("live_session_id", sessionId)
      .eq("question_id", questionId)
      .eq("participant_id", participantId)
      .maybeSingle(),
  );
  return row !== null;
}
