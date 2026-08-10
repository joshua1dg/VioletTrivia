import { z } from "zod";
import { commonContent, turn } from "../common";

/* ------------------------------------------------------------------ *
 * T1 — which_principle
 *
 * The one template whose stored and rendered shapes differ (PLAN §5.12).
 *
 * The author only ever references principle CODES; names and descriptors
 * live in the principles table, so renaming S2 must not mean rewriting jsonb
 * blobs. What is stored therefore carries `inPlayCodes`, and the components
 * receive `inPlay` with the reference data joined in.
 *
 * `lib/services/questions/hydrate.util.ts` (not owned here) is the boundary
 * between the two: it takes the stored content plus a principlesByCode map
 * and returns the hydrated content. Both shapes are defined here so that
 * function has something to be typed against.
 * ------------------------------------------------------------------ */

/** Option id IS the principle code today, so an answer compares directly. */
const option = z.object({
  id: z.string(),
  principleCode: z.string(),
  // NOTE: `subtext` was removed here and everywhere (D7 / PLAN §4.2). The
  // per-option line is the principle's descriptor, looked up from `inPlay`
  // by principleCode — one source of truth, no field to keep in sync.
});

/** What lives in `questions.content`. This is what `parse.content` validates. */
export const whichPrincipleContentStored = commonContent.extend({
  turns: z.array(turn),
  inPlayCodes: z.array(z.string()),
  options: z.array(option),
});
export type WhichPrincipleContentStored = z.infer<
  typeof whichPrincipleContentStored
>;

/** What Review, Reveal and Author receive, after hydration. */
export const whichPrincipleContentHydrated = commonContent.extend({
  turns: z.array(turn),
  inPlay: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      descriptor: z.string(),
    }),
  ),
  options: z.array(option),
});
export type WhichPrincipleContentHydrated = z.infer<
  typeof whichPrincipleContentHydrated
>;

/**
 * `WhichPrincipleContent` keeps meaning the shape the components take, which
 * is the hydrated one — so no component and no existing import changes.
 */
export type WhichPrincipleContent = WhichPrincipleContentHydrated;

export const whichPrincipleAnswerKey = z.object({
  key: z.string(),
  /** Paragraphs per option — the winner and the "not the issue here" one. */
  perOption: z.record(z.string(), z.array(z.string())),
  distinguish: z.object({ title: z.string(), body: z.string() }).optional(),
  summary: z.string().optional(),
});
export type WhichPrincipleKey = z.infer<typeof whichPrincipleAnswerKey>;
