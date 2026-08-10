import "server-only";

import { requireStaff } from "@/lib/auth";
import * as repo from "@/lib/repos/reports";
import { mergeSkipped, type SkippedRow } from "@/lib/repos/_shared";
import * as batchesService from "@/lib/services/batches";
import type { BatchStatus } from "@/lib/services/batches";
import * as questionsService from "@/lib/services/questions";

import { buildExclusions, type ExcludedQuestion } from "./exclusion.util";
import { gradeResponses } from "./grade.util";
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
  excluded: ExcludedQuestion[];
  skipped: SkippedRow[];
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

  const graded = gradeResponses(responses.rows, questionsById);
  const participantCount = new Set(
    responses.rows.map((response) => response.participantId),
  ).size;

  return {
    batch: { id: batch.id, name: batch.name, status: batch.status },
    participantCount,
    questionCount: questionIds.length,
    rubric: buildRubricRows(graded, principleLinks),
    topics: buildTopicRows(graded, topicLinks),
    excluded: buildExclusions(questionsResult.rows, responses.rows),
    skipped: mergeSkipped(responses, questionsResult),
  };
}
