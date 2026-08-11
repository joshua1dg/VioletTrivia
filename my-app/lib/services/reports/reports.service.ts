import "server-only";

import { AppError } from "@/lib/errors";
import { requireStaff } from "@/lib/auth";
import * as repo from "@/lib/repos/reports";
import { mergeSkipped, type SkippedRow } from "@/lib/repos/_shared";
import * as batchesService from "@/lib/services/batches";
import type { BatchStatus } from "@/lib/services/batches";
import * as principlesService from "@/lib/services/principles";
import * as questionsService from "@/lib/services/questions";
import type { AuthoredQuestion } from "@/lib/services/questions";
import * as topicsService from "@/lib/services/topics";
import { registry } from "@/lib/templates/registry";
import type {
  Answer,
  TallyGroup,
  TemplateKey,
} from "@/lib/templates/types";

import { dedupeToFirstAnswer } from "./dedupe.util";
import { buildExclusions, type ExcludedQuestion } from "./exclusion.util";
import { gradeResponses, keyCode, type GradedResponse } from "./grade.util";
import { buildRubricRows, type RubricRow } from "./rubric.util";
import { buildTopicRows, type TopicRow } from "./topic.util";

/**
 * D5: "where is the team miscalibrated." Correct-rate per rubric code and
 * per topic, computed at READ time via `registry[t].grade` — never stored
 * (PLAN §8). Authorization here, not in the page: the admin layout already
 * guards `/admin/*`, but a service is not allowed to assume its only caller
 * is gated (same reasoning `lib/services/topics/topics.service.ts` uses for
 * its writes) — every read below calls `requireStaff()` itself.
 */

export type BatchReportSummary = {
  id: string;
  name: string;
  status: BatchStatus;
  responseCount: number;
};

/**
 * /admin/reports. Only batches that actually have a response — a batch with
 * none has nothing to report on, and its detail page would render every
 * section empty. `<EmptyState>` is what the screen shows when this list is
 * empty (PLAN §8's "batches with response counts … EmptyState when no batch
 * has responses").
 */
export async function listBatchReportSummaries(): Promise<
  BatchReportSummary[]
> {
  await requireStaff();

  const rows = await repo.listBatchesWithResponseCounts();
  return rows.filter((row) => row.responseCount > 0);
}

export type BatchReport = {
  batch: { id: string; name: string; status: BatchStatus };
  participantCount: number;
  questionCount: number;
  rubric: RubricRow[];
  topics: TopicRow[];
  /** Per-question stats — BATCH-scoped, unlike the entity reports'
   *  org-wide rows: only answers given through this batch count here. */
  questions: QuestionStatRow[];
  excluded: ExcludedQuestion[];
  skipped: SkippedRow[];
  /** Repeat answers (same person, same question — e.g. async + a live
   *  session) dropped before grading; only the first counted. */
  duplicateCount: number;
};

/**
 * /admin/reports/[batchId] — the §8 sketch. `questions.listWithKey` is the
 * one legitimate staff read of `answer_key` on this whole route: grading
 * happens here, server-side, and only `RubricRow`/`TopicRow`/aggregate
 * counts ever reach a component — never a raw key or answer_key value.
 */
export async function getBatchReport(batchId: string): Promise<BatchReport> {
  await requireStaff();

  const [batch, questionIds] = await Promise.all([
    batchesService.getById(batchId),
    batchesService.getQuestionIds(batchId),
  ]);

  const [responses, questionsResult, principleLinks, topicLinks] =
    await Promise.all([
      repo.listResponsesForBatch(batchId),
      questionsService.listWithKey(questionIds),
      repo.listPrincipleLinksForQuestions(questionIds),
      repo.listTopicLinksForQuestions(questionIds),
    ]);

  const questionsById = new Map(
    questionsResult.rows.map((question) => [question.id, question]),
  );

  // One row per (participant, question) before grading — the first answer
  // is the calibration signal; repeats (async + live sessions) must not
  // stack the bars. `duplicateCount` is surfaced so the screen can say why
  // its denominators differ from the raw response total.
  const firstAnswers = dedupeToFirstAnswer(responses.rows);

  const graded = gradeResponses(firstAnswers.rows, questionsById);
  const participantCount = new Set(
    firstAnswers.rows.map((response) => response.participantId),
  ).size;

  return {
    batch: { id: batch.id, name: batch.name, status: batch.status },
    participantCount,
    questionCount: questionIds.length,
    rubric: buildRubricRows(graded, principleLinks),
    topics: buildTopicRows(graded, topicLinks),
    questions: statRows(questionsResult.rows, graded),
    excluded: buildExclusions(questionsResult.rows, responses.rows),
    skipped: mergeSkipped(responses, questionsResult),
    duplicateCount: firstAnswers.duplicateCount,
  };
}

/* ------------------------------------------------------------------ *
 * Question / topic / principle reports — the entity-centric dashboards
 * (2026-08-11: "everything clicks through to a report"). All three are
 * ORG-WIDE: a question's numbers span every batch and live session it has
 * run in, deduped to each participant's first answer, graded at read time
 * — same rules as the batch report, different scope.
 * ------------------------------------------------------------------ */

/** Per-question aggregate shared by the topic and principle reports. */
export type QuestionStatRow = {
  id: string;
  prompt: string;
  template: TemplateKey;
  /** Distinct first answers on record. */
  responseCount: number;
  /** Correct out of gradeable — both 0 for `write_feedback`. */
  correct: number;
  total: number;
};

export type QuestionReport = {
  question: {
    id: string;
    prompt: string;
    template: TemplateKey;
    status: questionsService.QuestionStatus;
  };
  topics: { slug: string; label: string }[];
  principleCodes: string[];
  /** The key's code, `which_principle` only. */
  keyCode: string | null;
  responseCount: number;
  participantCount: number;
  duplicateCount: number;
  /** Correct out of gradeable; null grade excluded. 0/0 for write_feedback. */
  correct: number;
  total: number;
  /**
   * The answer distribution, straight from `registry[t].tally` — the same
   * bars the presenter shows a live room, computed here over every first
   * answer the question has ever received. `null` for `write_feedback`.
   */
  tally: TallyGroup[] | null;
  /** `write_feedback` only: the prose answers themselves. */
  feedback: string[];
  /** Batches whose queue carries this question — the "Appears in" chips. */
  batches: { id: string; name: string }[];
  skipped: SkippedRow[];
};

export async function getQuestionReport(
  questionId: string,
): Promise<QuestionReport> {
  await requireStaff();

  const question = await questionsService.getWithKey(questionId);

  const [responses, principleLinks, topicLinks, batchLinks] =
    await Promise.all([
      repo.listResponsesForQuestions([questionId]),
      repo.listPrincipleLinksForQuestions([questionId]),
      repo.listTopicLinksForQuestions([questionId]),
      repo.listBatchLinksForQuestions([questionId]),
    ]);

  const firstAnswers = dedupeToFirstAnswer(responses.rows);
  const graded = gradeResponses(
    firstAnswers.rows,
    new Map([[question.id, question]]),
  );

  const gradeable = graded.filter((g) => g.grade !== null);
  const answers = firstAnswers.rows.map((row) => row.answer);

  return {
    question: {
      id: question.id,
      prompt: question.prompt,
      template: question.template,
      status: question.status,
    },
    topics: topicLinks.map((link) => ({
      slug: link.slug,
      label: link.label,
    })),
    principleCodes: principleLinks.map((link) => link.code),
    keyCode: keyCode(question),
    responseCount: firstAnswers.rows.length,
    participantCount: new Set(
      firstAnswers.rows.map((row) => row.participantId),
    ).size,
    duplicateCount: firstAnswers.duplicateCount,
    correct: gradeable.filter((g) => g.grade === 1).length,
    total: gradeable.length,
    tally: tallyFor(question, answers),
    feedback:
      question.template === "write_feedback"
        ? answers.flatMap((a) => (a.feedback ? [a.feedback] : []))
        : [],
    batches: dedupeBatches(batchLinks),
    skipped: responses.skipped,
  };
}

export type TopicReport = {
  topic: { id: string; slug: string; label: string };
  questionCount: number;
  responseCount: number;
  participantCount: number;
  duplicateCount: number;
  correct: number;
  total: number;
  questions: QuestionStatRow[];
  /** Rubric codes this topic's questions are keyed to, with counts. */
  keyCodes: { code: string; name: string; count: number }[];
  /** Batches carrying any of this topic's questions. */
  batches: { id: string; name: string }[];
  skipped: SkippedRow[];
};

export async function getTopicReport(slug: string): Promise<TopicReport> {
  await requireStaff();

  const topic = (await topicsService.listTopics()).find(
    (t) => t.slug === slug,
  );
  if (!topic) throw new AppError("not_found", "No such topic.");

  const questionIds = await repo.listQuestionIdsForTopic(topic.id);
  const [core, batchLinks, principles] = await Promise.all([
    loadQuestionStats(questionIds),
    repo.listBatchLinksForQuestions(questionIds),
    principlesService.listPrinciples(),
  ]);

  // Which codes this topic actually tests: the key codes of its
  // which_principle questions, with how many questions each.
  const nameByCode = new Map(principles.map((p) => [p.code, p.name]));
  const keyCounts = new Map<string, number>();
  for (const question of core.authored) {
    const code = keyCode(question);
    if (code) keyCounts.set(code, (keyCounts.get(code) ?? 0) + 1);
  }
  const keyCodes = [...keyCounts.entries()]
    .map(([code, count]) => ({
      code,
      name: nameByCode.get(code) ?? code,
      count,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    topic: { id: topic.id, slug: topic.slug, label: topic.label },
    questionCount: questionIds.length,
    responseCount: core.responseCount,
    participantCount: core.participantCount,
    duplicateCount: core.duplicateCount,
    correct: core.correct,
    total: core.total,
    questions: core.questions,
    keyCodes,
    batches: dedupeBatches(batchLinks),
    skipped: core.skipped,
  };
}

export type PrincipleReport = {
  principle: {
    code: string;
    name: string;
    shortDescriptor: string | null;
    fullDescription: string | null;
  };
  /** Questions whose ANSWER is this code — the ones that measure it. */
  keyedQuestionCount: number;
  /** Questions where it appears at all (key or distractor). */
  inPlayQuestionCount: number;
  responseCount: number;
  participantCount: number;
  duplicateCount: number;
  /** Found-rate: correct out of answers to questions KEYED to this code. */
  correct: number;
  total: number;
  /** What was picked instead when this code was missed, most common first. */
  pickedInstead: { code: string; name: string; count: number }[];
  /** How often this code was wrongly picked when some OTHER code was the
   *  answer — the inbound half of the confusion. */
  wronglyPickedCount: number;
  questions: QuestionStatRow[];
  /** Batches carrying any question keyed to this code. */
  batches: { id: string; name: string }[];
  skipped: SkippedRow[];
};

export async function getPrincipleReport(
  code: string,
): Promise<PrincipleReport> {
  await requireStaff();

  const principle = (await principlesService.listPrinciples()).find(
    (p) => p.code === code,
  );
  if (!principle) throw new AppError("not_found", "No such rubric code.");

  // In-play ids, then narrowed to the ones actually KEYED to this code —
  // those are the questions that measure it. The rest still contribute the
  // inbound-confusion count below.
  const inPlayIds = await repo.listQuestionIdsForPrinciple(principle.id);
  const inPlay = await questionsService.listWithKey(inPlayIds);
  const keyed = inPlay.rows.filter((q) => keyCode(q) === code);
  const keyedIds = keyed.map((q) => q.id);

  const [core, batchLinks] = await Promise.all([
    loadQuestionStats(keyedIds),
    repo.listBatchLinksForQuestions(keyedIds),
  ]);

  const missed = core.graded.filter((g) => g.grade === 0);
  const nameByCode = new Map(
    (await principlesService.listPrinciples()).map((p) => [p.code, p.name]),
  );
  const counts = new Map<string, number>();
  for (const g of missed) {
    if (g.pickedWrongCode === null) continue;
    counts.set(g.pickedWrongCode, (counts.get(g.pickedWrongCode) ?? 0) + 1);
  }
  const pickedInstead = [...counts.entries()]
    .map(([picked, count]) => ({
      code: picked,
      name: nameByCode.get(picked) ?? picked,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Inbound: answers to OTHER questions where this code was the wrong pick.
  const otherIds = inPlay.rows
    .filter((q) => keyCode(q) !== null && keyCode(q) !== code)
    .map((q) => q.id);
  const otherResponses = await repo.listResponsesForQuestions(otherIds);
  const otherGraded = gradeResponses(
    dedupeToFirstAnswer(otherResponses.rows).rows,
    new Map(inPlay.rows.map((q) => [q.id, q])),
  );
  const wronglyPickedCount = otherGraded.filter(
    (g) => g.pickedWrongCode === code,
  ).length;

  return {
    principle: {
      code: principle.code,
      name: principle.name,
      shortDescriptor: principle.shortDescriptor,
      fullDescription: principle.fullDescription,
    },
    keyedQuestionCount: keyedIds.length,
    inPlayQuestionCount: inPlayIds.length,
    responseCount: core.responseCount,
    participantCount: core.participantCount,
    duplicateCount: core.duplicateCount,
    correct: core.correct,
    total: core.total,
    pickedInstead,
    wronglyPickedCount,
    questions: core.questions,
    batches: dedupeBatches(batchLinks),
    skipped: mergeSkipped(inPlay, { skipped: core.skipped }),
  };
}

/** Distinct batches out of per-question link rows, in name order. */
function dedupeBatches(
  links: repo.BatchLinkRow[],
): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const link of links) byId.set(link.batchId, link.batchName);
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The shared middle of the topic and principle reports: load questions with
 * keys, load every response org-wide, dedupe to first answers, grade, and
 * fold into overall numbers plus one stat row per question.
 */
async function loadQuestionStats(questionIds: string[]): Promise<{
  responseCount: number;
  participantCount: number;
  duplicateCount: number;
  correct: number;
  total: number;
  questions: QuestionStatRow[];
  /** The parsed questions themselves, for callers that need key codes. */
  authored: AuthoredQuestion[];
  graded: GradedResponse[];
  skipped: SkippedRow[];
}> {
  const [questionsResult, responses] = await Promise.all([
    questionsService.listWithKey(questionIds),
    repo.listResponsesForQuestions(questionIds),
  ]);

  const questionsById = new Map(
    questionsResult.rows.map((question) => [question.id, question]),
  );

  const firstAnswers = dedupeToFirstAnswer(responses.rows);
  const graded = gradeResponses(firstAnswers.rows, questionsById);
  const gradeable = graded.filter((g) => g.grade !== null);

  const questions = statRows(questionsResult.rows, graded);

  return {
    responseCount: firstAnswers.rows.length,
    participantCount: new Set(
      firstAnswers.rows.map((row) => row.participantId),
    ).size,
    duplicateCount: firstAnswers.duplicateCount,
    correct: gradeable.filter((g) => g.grade === 1).length,
    total: gradeable.length,
    questions,
    authored: questionsResult.rows,
    graded,
    skipped: mergeSkipped(questionsResult, responses),
  };
}

/** One stat row per question, folded from already-graded responses. Both
 *  the batch report (batch-scoped graded set) and the entity reports
 *  (org-wide graded set) use this — the scope is whatever the caller
 *  graded. */
function statRows(
  questions: AuthoredQuestion[],
  graded: GradedResponse[],
): QuestionStatRow[] {
  return questions.map((question) => {
    const mine = graded.filter((g) => g.questionId === question.id);
    const mineGradeable = mine.filter((g) => g.grade !== null);
    return {
      id: question.id,
      prompt: question.prompt,
      template: question.template,
      responseCount: mine.length,
      correct: mineGradeable.filter((g) => g.grade === 1).length,
      total: mineGradeable.length,
    };
  });
}

/**
 * One cast at the runtime-template/static-union boundary — identical in
 * shape and reasoning to `lib/services/sessions`'s `templateFor`.
 */
function tallyFor(
  question: AuthoredQuestion,
  answers: Answer[],
): TallyGroup[] | null {
  const tally = registry[question.template].tally as
    | ((answers: Answer[], content: unknown, key: unknown) => TallyGroup[])
    | null;
  return tally ? tally(answers, question.content, question.answerKey) : null;
}
