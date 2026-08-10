import { z } from "zod";

/**
 * The composer's zod envelopes (PLAN §5.7/D11: "One schema, both entrances").
 *
 * `lib/schemas/` is read-only for Wave 3 (per this agent's brief), so these
 * live beside the action that parses them instead — legal under §5.7 as
 * long as the file stays free of `import "server-only"`, which it is: a
 * client form in `_ui/` may import this too for the same immediate-feedback
 * validation the plan asks for, and `actions.ts` (the trusted entrance)
 * imports it for real enforcement.
 */

export const batchStatus = z.enum(["draft", "active", "inactive"]);
export type BatchStatusInput = z.infer<typeof batchStatus>;

export const batchInput = z.object({
  name: z.string().trim().min(1, "A batch needs a name."),
  audience: z.string().trim().max(120).nullable().optional(),
  // ISO 8601 with an offset — the composer converts the <input
  // type="datetime-local"> value with `new Date(...).toISOString()` before
  // this ever runs, so a value that fails this check is a bug upstream, not
  // a user typo to word carefully.
  expiresAt: z.iso.datetime().nullable().optional(),
  asyncSampleSize: z.number().int().positive().nullable().optional(),
});
export type BatchInput = z.infer<typeof batchInput>;

/** Update takes the same envelope, partial — the id travels separately. */
export const batchUpdateInput = batchInput.partial();
export type BatchUpdateInput = z.infer<typeof batchUpdateInput>;

export const setStatusInput = z.object({
  id: z.uuid(),
  status: batchStatus,
});

export const setActiveAsyncInput = z.object({
  id: z.uuid(),
  active: z.boolean(),
});

/** Arrow-reorder sends the whole ordered queue, not a pair of indices. */
export const setQuestionsInput = z.object({
  id: z.uuid(),
  orderedIds: z.array(z.uuid()),
});
