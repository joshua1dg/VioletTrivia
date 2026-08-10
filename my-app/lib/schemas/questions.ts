import { z } from "zod";

import { templateKey } from "@/lib/templates/common";

/**
 * The authoring payload.
 *
 * `content` and `answerKey` are `unknown` HERE on purpose. Their real shape
 * depends on `template`, and the definition of that shape already exists in
 * one place — `registry[template].parse` — so restating it as a discriminated
 * union in this file would be a second source of truth that can drift.
 * `lib/services/questions` dehydrates the content and then runs it through
 * `registry[template].parse.content` / `.answerKey`, which is the validation
 * that matters. This schema's job is the envelope: the template is one of
 * three, the prompt is non-empty, the topic ids are uuids.
 *
 * `content` arrives in the HYDRATED shape the author form edits (T1 carries
 * `inPlay`, not `inPlayCodes`); the service dehydrates before parsing.
 */

export const questionStatus = z.enum(["draft", "live", "archived"]);
export type QuestionStatusInput = z.infer<typeof questionStatus>;

export const questionInput = z.object({
  template: templateKey,
  prompt: z.string().trim().min(1, "A question needs a prompt."),
  content: z.unknown(),
  answerKey: z.unknown(),
  status: questionStatus.default("draft"),
  topicIds: z.array(z.uuid()).default([]),
});
export type QuestionInput = z.infer<typeof questionInput>;

/** Update takes the same envelope; the id travels separately. */
export const questionUpdateInput = questionInput;
export type QuestionUpdateInput = QuestionInput;
