import "server-only";

/**
 * The public surface (PLAN §5.3). Nothing outside this folder imports
 * `questions.service.ts`, `hydrate.util.ts` or `excerpt.util.ts` directly.
 *
 * The two reads that carry the answer-key rule (§5.10):
 *
 *   getForReviewer(id) → ReviewerQuestion   NO answerKey property at all
 *   getWithKey(id)     → AuthoredQuestion   staff + async post-submit reveal
 *
 * `app/live/**` imports `getForReviewer` and never `getWithKey`.
 */

export {
  getForReviewer,
  getWithKey,
  listForReviewer,
  listWithKey,
  listQuestionSummaries,
  getForEditor,
  createQuestion,
  updateQuestion,
  archiveQuestion,
  setQuestionStatus,
  deleteQuestion,
  type EditableQuestion,
  type QuestionStatus,
  type QuestionSummary,
} from "./questions.service";

export type {
  AuthoredQuestion,
  ReviewerQuestion,
} from "./hydrate.util";

/**
 * Template-shape helpers, re-exported from the repo so that screens and
 * components have somewhere legal to import them from — nothing above
 * `lib/services` may import `lib/repos` (PLAN §5).
 */
export type {
  AnswerKeyOf,
  HydratedContent,
  StoredContent,
} from "@/lib/repos/questions";

export type { ListResult, SkippedRow } from "@/lib/repos/_shared";
