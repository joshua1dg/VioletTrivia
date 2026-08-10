import { z } from "zod";
import { commonContent, turn } from "../common";

/* ------------------------------------------------------------------ *
 * T2 — rank_variants
 *
 * Nothing here references a reference table, so stored === hydrated. The
 * hydrated alias exists anyway so hydration can be written once, uniformly,
 * against every template rather than special-casing T1 (PLAN §5.12).
 * ------------------------------------------------------------------ */

export const rankVariantsContentStored = commonContent.extend({
  turns: z.array(turn),
  subhead: z.string().optional(),
  options: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      /** What the variant does structurally, not what it says. */
      note: z.string(),
    }),
  ),
  /** Every reviewer sees the same variants in a different order. */
  shuffle: z.boolean().optional(),
});
export type RankVariantsContentStored = z.infer<
  typeof rankVariantsContentStored
>;

/** Passthrough: hydration has nothing to add to this template. */
export const rankVariantsContentHydrated = rankVariantsContentStored;
export type RankVariantsContentHydrated = RankVariantsContentStored;

export type RankVariantsContent = RankVariantsContentHydrated;

export const rankVariantsAnswerKey = z.object({
  /** Best first. grade is exact-match against this. */
  keyOrder: z.array(z.string()),
  rationaleTitle: z.string().optional(),
  rationale: z.string(),
});
export type RankVariantsKey = z.infer<typeof rankVariantsAnswerKey>;
