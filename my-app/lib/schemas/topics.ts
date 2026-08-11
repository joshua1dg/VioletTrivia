import { z } from "zod";

/**
 * Topics are the "why is this question worth asking" axis — a common
 * confusion, an edge case. NOT the failure mode; that is the principles
 * axis, and principles are read-only (D15).
 *
 * The four seeded values are placeholders until Josh supplies the real
 * vocabulary (§3), which is a UI edit rather than a migration.
 */

// No slug field: the slug is DERIVED from the label in the service
// (lowercased, spaces → dashes) rather than typed by the admin
// (2026-08-11 — "much easier than having them create an actual slug").
export const topicInput = z.object({
  label: z.string().trim().min(1, "A topic needs a label.").max(120),
  sortOrder: z.number().int().optional(),
});
export type TopicInput = z.infer<typeof topicInput>;

export const topicUpdateInput = topicInput.partial();
export type TopicUpdateInput = z.infer<typeof topicUpdateInput>;

/** Arrow-reorder sends the whole ordered list, not a pair of indices. */
export const reorderTopicsInput = z.array(z.uuid()).min(1);
export type ReorderTopicsInput = z.infer<typeof reorderTopicsInput>;
