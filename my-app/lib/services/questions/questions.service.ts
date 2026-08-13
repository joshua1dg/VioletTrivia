import "server-only";

import type { ZodType } from "zod";

import {
  canCurateMaster,
  requireProjectLead,
  requireStaff,
  type Staff,
} from "@/lib/auth";
import { AppError } from "@/lib/errors";
import * as repo from "@/lib/repos/questions";
import type { StoredContent } from "@/lib/repos/questions";
import * as staffRepo from "@/lib/repos/staff";
import type { ListResult } from "@/lib/repos/_shared";
import type { QuestionInput } from "@/lib/schemas/questions";
import * as principles from "@/lib/services/principles";
import { registry } from "@/lib/templates/registry";
import type { TemplateKey } from "@/lib/templates/types";

import { excerptFrom } from "./excerpt.util";
import {
  dehydrateContent,
  hydrateContent,
  hydrateQuestion,
  hydrateQuestionWithKey,
  principleCodesFor,
  type AuthoredQuestion,
  type ReviewerQuestion,
} from "./hydrate.util";

export type QuestionStatus = repo.QuestionStatus;
export type ReviewStatus = repo.ReviewStatus;

/* ------------------------------------------------------------------ *
 * Reads
 *
 * THE ANSWER-KEY RULE, made structural (PLAN §5.10):
 *
 *   getForReviewer → ReviewerQuestion   no answerKey property, at all
 *   getWithKey     → AuthoredQuestion   staff + the async post-submit reveal
 *
 * `/live/[room]` may call `getForReviewer` and nothing else, ever. The two
 * return types are not assignable in the direction that would matter, so a
 * component typed against `ReviewerQuestion` cannot render a key even if it
 * tried — there is no property to reach for.
 * ------------------------------------------------------------------ */

export async function getForReviewer(id: string): Promise<ReviewerQuestion> {
  const [row, index] = await Promise.all([
    repo.getForReviewer(id),
    principles.principlesByCode(),
  ]);
  return hydrateQuestion(row, index);
}

export async function getWithKey(id: string): Promise<AuthoredQuestion> {
  const [row, index] = await Promise.all([
    repo.getWithKey(id),
    principles.principlesByCode(),
  ]);
  return hydrateQuestionWithKey(row, index);
}

/** The drawn set, in draw order. Soft-fails: one bad row is skipped, not fatal. */
export async function listForReviewer(
  ids: string[],
): Promise<ListResult<ReviewerQuestion>> {
  const [result, index] = await Promise.all([
    repo.listForReviewer(ids),
    principles.principlesByCode(),
  ]);
  return {
    rows: result.rows.map((row) => hydrateQuestion(row, index)),
    skipped: result.skipped,
  };
}

/** Reveals for already-answered questions — the async resume path. */
export async function listWithKey(
  ids: string[],
): Promise<ListResult<AuthoredQuestion>> {
  const [result, index] = await Promise.all([
    repo.listWithKey(ids),
    principles.principlesByCode(),
  ]);
  return {
    rows: result.rows.map((row) => hydrateQuestionWithKey(row, index)),
    skipped: result.skipped,
  };
}

/** One row of the admin library. */
export type QuestionSummary = {
  id: string;
  template: TemplateKey;
  /** The registry's label — nothing else in the app branches on `template`. */
  templateLabel: string;
  prompt: string;
  excerpt: string;
  status: QuestionStatus;
  reviewStatus: ReviewStatus;
  /** The roundtable's "why" — shown to the submitter on denial. */
  reviewNote: string | null;
  authorId: string | null;
  /** displayName ?? email, resolved from the staff list; null for
   * authorless rows (seeds) or departed staff. */
  authorLabel: string | null;
  topicIds: string[];
  topicSlugs: string[];
  principleCodes: string[];
  responseCount: number;
  updatedAt: string;
};

/**
 * SAFE BY DEFAULT: with no `reviewStatuses`, only approved questions come
 * back — the library, the batch composer, the topic views all get the
 * vetted set without having to remember to ask for it. The Proposals tab
 * is the one caller that passes an explicit review filter.
 */
export async function listQuestionSummaries(options?: {
  statuses?: QuestionStatus[];
  reviewStatuses?: ReviewStatus[];
  authorId?: string;
}): Promise<ListResult<QuestionSummary>> {
  const [result, staffRows] = await Promise.all([
    repo.listSummaries({
      ...options,
      reviewStatuses: options?.reviewStatuses ?? ["approved"],
    }),
    staffRepo.list(),
  ]);

  const staffById = new Map(staffRows.map((row) => [row.userId, row]));

  return {
    rows: result.rows.map((row) => {
      const author = row.authorId ? staffById.get(row.authorId) : undefined;
      return {
        id: row.id,
        template: row.template,
        templateLabel: registry[row.template].label,
        prompt: row.prompt,
        excerpt: excerptFrom(row.content),
        status: row.status,
        reviewStatus: row.reviewStatus,
        reviewNote: row.reviewNote,
        authorId: row.authorId,
        authorLabel: author ? (author.displayName ?? author.email) : null,
        topicIds: row.topicIds,
        topicSlugs: row.topicSlugs,
        principleCodes: row.principleCodes,
        responseCount: row.responseCount,
        updatedAt: row.updatedAt,
      };
    }),
    skipped: result.skipped,
  };
}

/**
 * The Proposals tab, both audiences in one read (2026-08-12): everyone
 * sees their own submissions with verdicts and notes; project leads and
 * admins additionally get the pending pile. `queue: null` (not `[]`) for
 * pod leads — the section doesn't exist for them, it isn't merely empty.
 */
export type ProposalsView = {
  viewerCanReview: boolean;
  mine: QuestionSummary[];
  queue: QuestionSummary[] | null;
};

export async function getProposalsView(): Promise<ProposalsView> {
  const staff = await requireStaff();
  const reviewer = canCurateMaster(staff);

  const [mine, queue] = await Promise.all([
    listQuestionSummaries({
      authorId: staff.userId,
      reviewStatuses: ["proposed", "denied", "approved"],
    }),
    reviewer
      ? listQuestionSummaries({ reviewStatuses: ["proposed"] })
      : Promise.resolve(null),
  ]);

  return {
    viewerCanReview: reviewer,
    // A curator's own direct-to-library work is born approved with no
    // reviewer; showing it under "your proposals" would be noise. Keep
    // rows that went through review (have a verdict trail) or await one.
    mine: mine.rows.filter(
      (row) => row.reviewStatus !== "approved" || !reviewer,
    ),
    queue: queue ? queue.rows : null,
  };
}

/** Everything the editor needs to reopen a question: key, topics, codes. */
export type EditableQuestion = AuthoredQuestion & {
  topicIds: string[];
  principleCodes: string[];
};

export async function getForEditor(id: string): Promise<EditableQuestion> {
  const staff = await requireStaff();

  const [question, topicIds, principleCodes] = await Promise.all([
    getWithKey(id),
    repo.listTopicIdsFor(id),
    repo.listPrincipleCodesFor(id),
  ]);

  assertCanEdit(staff, question);

  return { ...question, topicIds, principleCodes };
}

/**
 * Who may open/save a question (Wave 2): curators, always; anyone else
 * only their OWN work while it still awaits the roundtable (proposed or
 * denied). Once approved it is master content — a submitter editing it
 * after the fact would un-vet it silently.
 */
function assertCanEdit(
  staff: Staff,
  question: { authorId: string | null; reviewStatus: repo.ReviewStatus },
): void {
  if (canCurateMaster(staff)) return;
  if (
    question.authorId === staff.userId &&
    question.reviewStatus !== "approved"
  ) {
    return;
  }
  throw new AppError(
    "forbidden",
    "Only project leads can edit approved questions.",
  );
}

/* ------------------------------------------------------------------ *
 * Writes
 *
 * Authorization lives here, not in the action: a Server Action is a public
 * endpoint, and not rendering the form protects nothing (§7.2).
 *
 * NOT TRANSACTIONAL (D13). Saving a question is three writes — the row,
 * `question_topics`, `question_principles` — and PostgREST has no
 * transaction to wrap them in. A failure part-way leaves a question with
 * stale tags; re-saving fixes it. This is the README's stated trigger for
 * adding Drizzle, and the moment to revisit is when partial writes actually
 * bite, not before.
 * ------------------------------------------------------------------ */

export async function createQuestion(
  input: QuestionInput,
): Promise<{ id: string }> {
  const staff = await requireStaff();
  const curator = canCurateMaster(staff);

  const { storedContent, answerKey, principleCodes } = await validate(input);

  // Same form for everyone; the ROLE decides where it lands (Wave 2).
  // A curator's question goes wherever they pointed it. Anyone else's is
  // forced into the pile: review_status 'proposed', lifecycle 'draft' —
  // whatever status the client claimed. A Server Action is a public
  // endpoint; the forcing happens here, not in the form.
  const { id } = await repo.insert({
    template: input.template,
    prompt: input.prompt,
    content: storedContent,
    answerKey,
    status: curator ? input.status : "draft",
    reviewStatus: curator ? "approved" : "proposed",
    authorId: staff.userId,
  });

  // Not transactional — see the note above. The question exists from here on
  // even if the junction writes fail.
  await writeRelations(id, input.topicIds, principleCodes);

  return { id };
}

export async function updateQuestion(
  id: string,
  input: QuestionInput,
): Promise<{ id: string }> {
  const staff = await requireStaff();
  const current = await repo.getWithKey(id);
  assertCanEdit(staff, current);
  const curator = canCurateMaster(staff);

  const { storedContent, answerKey, principleCodes } = await validate(input);

  await repo.update(id, {
    template: input.template,
    prompt: input.prompt,
    content: storedContent,
    answerKey,
    status: curator ? input.status : "draft",
    // The resubmit path, implicit on purpose: a submitter saving a DENIED
    // question sends it back to the pile — revision beside the note, no
    // separate "resubmit" button to forget. Curator saves never touch the
    // review dimension here; verdicts go through approve/deny below.
    ...(curator ? {} : { reviewStatus: "proposed" as const }),
  });

  // Not transactional — see the note above.
  await repo.deleteTopicsFor(id);
  await repo.deletePrinciplesFor(id);
  await writeRelations(id, input.topicIds, principleCodes);

  return { id };
}

/** The normal path for anything that has been seen by a reviewer.
 * Lifecycle is curation — project leads and admins (PODS.md: leads and
 * above own the master set; requireAdmin here predated the role tiers). */
export async function archiveQuestion(id: string): Promise<void> {
  await requireProjectLead();
  await repo.setStatus(id, "archived");
}

export async function setQuestionStatus(
  id: string,
  status: QuestionStatus,
): Promise<void> {
  await requireProjectLead();
  await repo.setStatus(id, status);
}

/**
 * Only succeeds on an unanswered question: `responses.question_id` is
 * ON DELETE RESTRICT, so Postgres refuses the rest and the repo turns that
 * 23503 into "This question has been answered — archive it instead."
 *
 * Admin (system tier), with one exception: a submitter withdrawing their
 * OWN still-unapproved proposal. That's taking back a suggestion, not
 * deleting master content.
 */
export async function deleteQuestion(id: string): Promise<void> {
  const staff = await requireStaff();
  if (staff.role !== "admin") {
    const current = await repo.getWithKey(id);
    const withdrawingOwn =
      current.authorId === staff.userId &&
      current.reviewStatus !== "approved";
    if (!withdrawingOwn) {
      throw new AppError(
        "forbidden",
        "This action requires an admin account.",
      );
    }
  }
  await repo.remove(id);
}

/* ------------------------------------------------------------------ *
 * The roundtable's verdicts (Wave 2)
 * ------------------------------------------------------------------ */

/**
 * Approve = vetted AND playable: review flips to 'approved', lifecycle to
 * 'live' in the same breath. The roundtable just agreed it's ready — an
 * approved-but-draft question that nobody remembers to publish is the
 * failure mode this avoids. Curators can still demote to draft after.
 */
export async function approveQuestion(id: string): Promise<void> {
  const staff = await requireProjectLead();
  await assertAwaitingReview(id);
  await repo.setReviewDecision(id, {
    reviewStatus: "approved",
    reviewNote: null,
    reviewedBy: staff.userId,
  });
  await repo.setStatus(id, "live");
}

/** The note is required: there are no notifications, so the note IS the
 * feedback channel — a bare "denied" teaches the submitter nothing. */
export async function denyQuestion(id: string, note: string): Promise<void> {
  const staff = await requireProjectLead();
  const trimmed = note.trim();
  if (!trimmed) {
    throw new AppError(
      "validation",
      "Say why — the note is the only feedback the submitter gets.",
    );
  }
  await assertAwaitingReview(id);
  await repo.setReviewDecision(id, {
    reviewStatus: "denied",
    reviewNote: trimmed,
    reviewedBy: staff.userId,
  });
}

/** Verdicts land on the pile only — approving an already-approved (or
 * re-denying a denied) question is a stale screen, not a state change. */
async function assertAwaitingReview(id: string): Promise<void> {
  const current = await repo.getWithKey(id);
  if (current.reviewStatus !== "proposed") {
    throw new AppError(
      "conflict",
      "This question already has a verdict — refresh to see it.",
    );
  }
}

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

async function validate(input: QuestionInput) {
  const template = input.template;

  // The author form edits the HYDRATED shape; what gets stored is the
  // dehydrated one, and that is what `parse.content` describes.
  const storedContent = parseWith(
    registry[template].parse.content,
    dehydrateContent(template, input.content),
    "content",
  );
  const answerKey = parseWith(
    registry[template].parse.answerKey,
    input.answerKey,
    "answer key",
  );

  // `principleCodes` reads the HYDRATED shape, so derive it from what was
  // just validated rather than from the raw input — the editor sends the
  // hydrated shape, but a re-save of a parsed row sends the stored one, and
  // this way both work. The reference data is irrelevant here (only `code`
  // is read), so the index can be empty.
  const principleCodes = principleCodesFor(
    template,
    hydrateContent(template, storedContent as StoredContent<TemplateKey>, {}),
  );

  return { storedContent, answerKey, principleCodes };
}

/**
 * `registry[template]` is a union at compile time when `template` is only
 * known at runtime, so the schema is widened once here rather than at each
 * call site. The runtime check is unaffected — it is the same zod schema.
 */
function parseWith(
  schema: unknown,
  value: unknown,
  label: string,
): unknown {
  const result = (schema as ZodType<unknown>).safeParse(value);
  if (result.success) return result.data;

  const first = result.error.issues[0];
  const path = first?.path?.join(".") ?? "";
  throw new AppError(
    "validation",
    `This ${label} isn't complete${path ? ` — check "${path}"` : ""}: ${
      first?.message ?? "invalid"
    }`,
    { cause: result.error, message: `${label} failed to parse` },
  );
}

async function writeRelations(
  questionId: string,
  topicIds: string[],
  principleCodes: string[],
): Promise<void> {
  await repo.insertTopics(questionId, topicIds);

  const idsByCode = await principles.principleIdsByCode();
  const principleIds = principleCodes.flatMap((code) => {
    const id = idsByCode[code];
    if (!id) {
      // A code with no row is a seed/vocabulary gap (§3), not a save failure.
      console.error(
        `[questions] unknown principle code ${code} on question ${questionId} — not linked`,
      );
      return [];
    }
    return [id];
  });

  await repo.insertPrinciples(questionId, principleIds);
}
