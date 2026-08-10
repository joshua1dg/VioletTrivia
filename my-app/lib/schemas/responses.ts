import { z } from "zod";

import { answer } from "@/lib/templates/common";

/**
 * One schema, both entrances (PLAN §5.7). The client form validates against
 * this for immediate feedback; the Server Action validates against it again,
 * and that one is the one that is trusted.
 *
 * Async and live get SEPARATE schemas, mirroring the two separate actions
 * (§5.5). `submitAnswerInput` has no `liveSessionId` field to leave
 * undefined, and `submitLiveAnswerInput` requires one — so a live submit
 * cannot degrade into an async submit (the path that would post an answer
 * key to a phone in a live room).
 */

const rationale = z.string().trim().max(4000).optional();

/** `/b/{token}` — async. The token is the participant's only credential. */
export const submitAnswerInput = z.object({
  participantId: z.uuid(),
  questionId: z.uuid(),
  batchToken: z.string().min(1),
  answer,
  rationale,
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerInput>;

/** `/live/[room]` — live. Owned here, consumed by F5's app/live/actions.ts. */
export const submitLiveAnswerInput = z.object({
  participantId: z.uuid(),
  questionId: z.uuid(),
  liveSessionId: z.uuid(),
  answer,
  rationale,
});
export type SubmitLiveAnswerInput = z.infer<typeof submitLiveAnswerInput>;
