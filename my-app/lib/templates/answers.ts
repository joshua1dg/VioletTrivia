import type { ZodType } from "zod";

import type { Answer, TemplateKey } from "./types";
import { whichPrincipleAnswer } from "./which-principle/schema";
import { rankVariantsAnswer } from "./rank-variants/schema";
import { writeFeedbackAnswer } from "./write-feedback/schema";

/**
 * Per-template "is this answer complete?" — THE submit gate, client and
 * server, so the disabled state on a submit button and the validation in
 * both submit services can never disagree (the empty-ranking bug of
 * 2026-08-10 was exactly such a disagreement: three hand-written gates,
 * one of them wrong).
 *
 * Deliberately its own module rather than a `registry` member: the registry
 * imports every template's components, and `lib/services/responses/
 * live-submit.service.ts` — which must validate answers too — is forbidden
 * from importing anything on the answer-key path. This file is schemas
 * only: no components, no keys, no server imports, safe on every surface.
 *
 * The shared `answer` schema in `common.ts` stays loose — it parses stored
 * jsonb on the way OUT of the database. These are the strict shapes for the
 * way IN.
 */
export const answerSchema: Record<TemplateKey, ZodType<Answer>> = {
  which_principle: whichPrincipleAnswer,
  rank_variants: rankVariantsAnswer,
  write_feedback: writeFeedbackAnswer,
};

export function isAnswerComplete(
  template: TemplateKey,
  answer: Answer,
): boolean {
  return answerSchema[template].safeParse(answer).success;
}
