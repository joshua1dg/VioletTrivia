import { z } from "zod";
import { commonContent, turn } from "../common";

/* ------------------------------------------------------------------ *
 * T3 — write_feedback
 *
 * The reviewer reads a fellow's rationale, decides for themselves whether it
 * holds, and WRITES their own feedback. There are no options — the answer is
 * prose. The reveal is a fixed three-move breakdown plus a worked example.
 *
 * Stored === hydrated, as with T2.
 * ------------------------------------------------------------------ */

export const writeFeedbackContentStored = commonContent.extend({
  /** [0] is the user's request, [1] is the completion being reviewed. */
  turns: z.array(turn),
  subject: z.object({ rationale: z.string() }),
});
export type WriteFeedbackContentStored = z.infer<
  typeof writeFeedbackContentStored
>;

/** Passthrough: hydration has nothing to add to this template. */
export const writeFeedbackContentHydrated = writeFeedbackContentStored;
export type WriteFeedbackContentHydrated = WriteFeedbackContentStored;

export type WriteFeedbackContent = WriteFeedbackContentHydrated;

/** A COMPLETE answer: actual prose, not whitespace. */
export const writeFeedbackAnswer = z.object({
  feedback: z.string().trim().min(1),
});

export const writeFeedbackAnswerKey = z.object({
  /** The pill at the top of the reveal, e.g. "Rationale is weak". */
  verdict: z.string(),
  verdictTone: z.enum(["weak", "strong"]),
  /** The three moves, in order. */
  blocks: z.object({
    working: z.string(),
    correcting: z.string(),
    improve: z.string(),
  }),
  /** "Feedback that lands" — a worked example of the whole thing. */
  exemplar: z.string(),
  toneNote: z.string().optional(),
});
export type WriteFeedbackKey = z.infer<typeof writeFeedbackAnswerKey>;
