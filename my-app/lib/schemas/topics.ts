import { z } from "zod";

/**
 * Topics are the "why is this question worth asking" axis — a common
 * confusion, an edge case. NOT the failure mode; that is the principles
 * axis, and principles are read-only (D15).
 *
 * The four seeded values are placeholders until Josh supplies the real
 * vocabulary (§3), which is a UI edit rather than a migration.
 */

const slug = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens.",
  );

export const topicInput = z.object({
  slug,
  label: z.string().trim().min(1, "A topic needs a label.").max(120),
  sortOrder: z.number().int().optional(),
});
export type TopicInput = z.infer<typeof topicInput>;

export const topicUpdateInput = topicInput.partial();
export type TopicUpdateInput = z.infer<typeof topicUpdateInput>;

/** Arrow-reorder sends the whole ordered list, not a pair of indices. */
export const reorderTopicsInput = z.array(z.uuid()).min(1);
export type ReorderTopicsInput = z.infer<typeof reorderTopicsInput>;
