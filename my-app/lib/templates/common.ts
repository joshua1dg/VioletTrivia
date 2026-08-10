import { z } from "zod";

/**
 * The pieces every template shares, as zod schemas.
 *
 * These are the SINGLE source of truth for the shapes: the TypeScript types
 * are inferred from the schemas rather than written twice. `types.ts` is a
 * barrel that re-exports the inferred types, so nothing outside this folder
 * changes its imports.
 *
 * Nothing in `lib/templates/**` may import `server-only`: a client form
 * validates against exactly the same module the Server Action does (PLAN
 * §5.7). Keep this file free of server imports.
 */

/**
 * Drives the `template` enum in the database. Adding a value here is one
 * line; the registry then stops compiling until the new template exists.
 */
export const templateKey = z.enum([
  "which_principle",
  "rank_variants",
  "write_feedback",
]);
export type TemplateKey = z.infer<typeof templateKey>;

/**
 * One turn of the excerpt being judged.
 *
 * `body` is light markdown — lines starting with "- " render as bullets and
 * `backticks` render as code. T3's assistant turns need bullets, and letting
 * the author write markdown beats inventing a nested structure for it.
 */
export const turn = z.object({
  role: z.enum(["user", "assistant"]),
  body: z.string(),
  meta: z.string().optional(), // "1 sentence · turn 3"
});
export type Turn = z.infer<typeof turn>;

/**
 * Carried by every template's content, so it lives here rather than being
 * repeated three times. Each template's content schema is this, extended.
 */
export const commonContent = z.object({
  /** Footer line under the action button. */
  footerHint: z.string().optional(),
  /**
   * Label for the optional "Why?" note. Omit and the field doesn't render.
   * It maps to responses.rationale, which every template offers, so the flow
   * renders it — not the template body.
   */
  notePrompt: z.string().optional(),
});
export type CommonContent = z.infer<typeof commonContent>;

/**
 * What a participant submits — `responses.answer`, which is untyped jsonb and
 * therefore always parsed on the way out (PLAN §5.7).
 *
 *   option   pick-one templates
 *   order    rank_variants
 *   feedback write_feedback — prose, so nothing to compare a key against
 */
export const answer = z.object({
  option: z.string().optional(),
  order: z.array(z.string()).optional(),
  feedback: z.string().optional(),
});
export type Answer = z.infer<typeof answer>;
