import "server-only";

import { AppError } from "@/lib/errors";
import { podScopeId, requireStaff, type Staff } from "@/lib/auth";
import * as linksRepo from "@/lib/repos/batch-links";
import * as repo from "@/lib/repos/reports";
import type { ReportResponseRow } from "@/lib/repos/reports";
import { mergeSkipped, type SkippedRow } from "@/lib/repos/_shared";
import * as staffRepo from "@/lib/repos/staff";
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
import {
  buildPodAttribution,
  buildPodSlice,
  type PodAttribution,
  type PodSlice,
} from "./pod.util";
import { buildRubricRows, type RubricRow } from "./rubric.util";
import { buildTopicRows, type TopicRow } from "./topic.util";

/* ------------------------------------------------------------------ *
 * Pod comparison — PODS.md Wave 1's "every analytics view shows their
 * pod's slice NEXT TO the project-level numbers." One attribution map
 * (batch_links + batch owners + session hosts) built per read, and one
 * scope-resolution rule: a pod lead ALWAYS sees their own slice (`?pod=`
 * is ignored outright — the access rule in PODS.md's role matrix: reads
 * are full for everyone, but a pod lead's slice is never someone else's);
 * a project lead/admin sees whatever pod `?pod=` names, or none.
 * ------------------------------------------------------------------ */

async function loadPodAttribution(): Promise<PodAttribution> {
  const [links, batches, sessions] = await Promise.all([
    linksRepo.listAll(),
    repo.listBatchOwners(),
    repo.listSessionHosts(),
  ]);
  return buildPodAttribution(links, batches, sessions);
}

function resolvePodScope(
  staff: Staff,
  requestedPodId: string | null | undefined,
): string | null {
  return podScopeId(staff) ?? requestedPodId ?? null;
}

/** "Your pod" for the lead looking at their own slice; the lead's display
 * name (or email) when a project lead/admin picked them via the selector. */
async function podLabel(staff: Staff, podId: string): Promise<string> {
  if (podId === staff.userId) return "Your pod";
  const rows = await staffRepo.list();
  const row = rows.find((r) => r.userId === podId);
  return row?.displayName ?? row?.email ?? "That pod";
}

/** The topic/principle reports' `pod` block, off whatever `loadQuestionStats`
 *  already computed — no second fetch, no second grading pass. */
async function buildPodOverall(
  staff: Staff,
  podId: string | null,
  core: { pod: PodSlice | null; authored: AuthoredQuestion[] },
): Promise<PodOverall | null> {
  if (!podId || !core.pod) return null;
  return {
    podId,
    label: await podLabel(staff, podId),
    responseCount: core.pod.responseCount,
    correct: core.pod.correct,
    total: core.pod.total,
    questions: statRows(core.authored, core.pod.graded),
  };
}

export type PodBreakdownRow = {
  podId: string;
  label: string;
  responseCount: number;
  correct: number;
  total: number;
};

/**
 * Every pod side by side over THIS page's response set — the "how are the
 * pods doing against each other" view (2026-08-11). Full-scope viewers
 * (project leads, admins) only; a pod lead gets null — their own slice is
 * the `pod` block, and other pods' slices are not theirs to see. Pods with
 * no attributable answers are omitted, never zero-barred. Best rate first,
 * since the section's whole question is relative standing.
 */
async function buildPodBreakdownRows(
  staff: Staff,
  rows: ReportResponseRow[],
  questionsById: Map<string, AuthoredQuestion>,
): Promise<PodBreakdownRow[] | null> {
  if (podScopeId(staff) !== null) return null;

  const [staffRows, attribution] = await Promise.all([
    staffRepo.list(),
    loadPodAttribution(),
  ]);

  const breakdown = staffRows
    .filter((row) => row.role === "pod_lead")
    .map((row) => {
      const slice = buildPodSlice(rows, row.userId, attribution, questionsById);
      return {
        podId: row.userId,
        label: row.displayName ?? row.email ?? row.userId,
        responseCount: slice.responseCount,
        correct: slice.correct,
        total: slice.total,
      };
    })
    .filter((row) => row.responseCount > 0)
    .sort(
      (a, b) =>
        (b.total > 0 ? b.correct / b.total : -1) -
        (a.total > 0 ? a.correct / a.total : -1),
    );

  return breakdown.length > 0 ? breakdown : null;
}

export type PodOption = { userId: string; label: string };

/** Pod leads, for the selector project leads/admins get on the org
 * dashboard and the batch report (PODS.md: "sliceable by pod"). */
export async function listPodOptions(): Promise<PodOption[]> {
  await requireStaff();
  const rows = await staffRepo.list();
  return rows
    .filter((row) => row.role === "pod_lead")
    .map((row) => ({
      userId: row.userId,
      label: row.displayName ?? row.email ?? row.userId,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Overall + rubric + topics, pod-scoped — the org and batch reports' `pod`
 * block. Same shape both places since both build it off `buildRubricRows`/
 * `buildTopicRows` over the pod's graded responses, same as the project
 * numbers beside it. */
export type PodComparison = {
  podId: string;
  label: string;
  responseCount: number;
  correct: number;
  total: number;
  rubric: RubricRow[];
  topics: TopicRow[];
};

/** Overall only, pod-scoped — the topic and principle reports' `pod` block
 * (plus per-question rows, cheap to fold in since the grading already
 * happened). */
export type PodOverall = {
  podId: string;
  label: string;
  responseCount: number;
  correct: number;
  total: number;
  questions: QuestionStatRow[];
};

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
  /** Correct out of gradeable, whole batch — the headline donut. */
  correct: number;
  total: number;
  /** Answers per day (RAW response counts — activity, so repeats count). */
  activity: DayCount[];
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
  /** null when the viewer has no personal slice (project lead/admin) —
   *  the page uses this to decide whether to offer the pod selector. */
  viewerPodScope: string | null;
  /** Set for a pod lead (always their own), or for a project lead/admin
   *  who picked one via `?pod=`. Same shape as `OrgReport.pod`. */
  pod: PodComparison | null;
  /** Every pod side by side (full-scope viewers only) — see
   * `buildPodBreakdownRows`. */
  podBreakdown: PodBreakdownRow[] | null;
};

/**
 * /admin/reports/[batchId] — the §8 sketch. `questions.listWithKey` is the
 * one legitimate staff read of `answer_key` on this whole route: grading
 * happens here, server-side, and only `RubricRow`/`TopicRow`/aggregate
 * counts ever reach a component — never a raw key or answer_key value.
 */
export async function getBatchReport(
  batchId: string,
  requestedPodId?: string | null,
): Promise<BatchReport> {
  const staff = await requireStaff();
  const podId = resolvePodScope(staff, requestedPodId);

  const [batch, questionIds] = await Promise.all([
    batchesService.getById(batchId),
    batchesService.getQuestionIds(batchId),
  ]);

  const [responses, questionsResult, principleLinks, topicLinks, attribution] =
    await Promise.all([
      repo.listResponsesForBatch(batchId),
      questionsService.listWithKey(questionIds),
      repo.listPrincipleLinksForQuestions(questionIds),
      repo.listTopicLinksForQuestions(questionIds),
      podId ? loadPodAttribution() : Promise.resolve(null),
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
  const gradeable = graded.filter((g) => g.grade !== null);
  const participantCount = new Set(
    firstAnswers.rows.map((response) => response.participantId),
  ).size;

  let pod: PodComparison | null = null;
  if (podId && attribution) {
    const slice = buildPodSlice(responses.rows, podId, attribution, questionsById);
    pod = {
      podId,
      label: await podLabel(staff, podId),
      responseCount: slice.responseCount,
      correct: slice.correct,
      total: slice.total,
      rubric: buildRubricRows(slice.graded, principleLinks),
      topics: buildTopicRows(slice.graded, topicLinks),
    };
  }

  return {
    batch: { id: batch.id, name: batch.name, status: batch.status },
    participantCount,
    questionCount: questionIds.length,
    correct: gradeable.filter((g) => g.grade === 1).length,
    total: gradeable.length,
    activity: dailyCounts(responses.rows.map((row) => row.createdAt)),
    rubric: buildRubricRows(graded, principleLinks),
    topics: buildTopicRows(graded, topicLinks),
    questions: statRows(questionsResult.rows, graded),
    excluded: buildExclusions(questionsResult.rows, responses.rows),
    skipped: mergeSkipped(responses, questionsResult),
    duplicateCount: firstAnswers.duplicateCount,
    viewerPodScope: podScopeId(staff),
    pod,
    podBreakdown: await buildPodBreakdownRows(
      staff,
      responses.rows,
      questionsById,
    ),
  };
}

/** One point of the activity chart: a UTC day and its raw answer count. */
export type DayCount = { day: string; count: number };

export type OrgReport = {
  participantCount: number;
  responseCount: number;
  duplicateCount: number;
  /** Answers per day, org-wide (raw counts — activity, repeats included). */
  activity: DayCount[];
  /** Questions with at least one answer / all questions. */
  answeredQuestionCount: number;
  questionCount: number;
  correct: number;
  total: number;
  rubric: RubricRow[];
  topics: TopicRow[];
  /** Key→picked pairs across every which_principle miss, most common
   *  first — "the team confuses X for Y", ranked. */
  confusions: {
    keyCode: string;
    keyName: string;
    pickedCode: string;
    pickedName: string;
    count: number;
  }[];
  batches: BatchReportSummary[];
  skipped: SkippedRow[];
  /** null when the viewer has no personal slice (project lead/admin) —
   *  the page uses this to decide whether to offer the pod selector. */
  viewerPodScope: string | null;
  /** Set for a pod lead (always their own), or for a project lead/admin
   *  who picked one via `?pod=`. */
  pod: PodComparison | null;
  /** Every pod side by side (full-scope viewers only) — see
   * `buildPodBreakdownRows`. */
  podBreakdown: PodBreakdownRow[] | null;
};

/**
 * /admin/reports — the org-wide dashboard: every batch report's sections
 * with the batch filter removed (2026-08-11: the tab was redundant once
 * batch rows linked to their own reports; "where is the TEAM miscalibrated
 * overall" had no home). Same rules as everywhere: dedupe to each
 * participant's first answer per question — here across ALL batches and
 * sessions — and grade at read time.
 */
export async function getOrgReport(
  requestedPodId?: string | null,
): Promise<OrgReport> {
  const staff = await requireStaff();
  const podId = resolvePodScope(staff, requestedPodId);

  const summaries = await questionsService.listQuestionSummaries();
  const allIds = summaries.rows.map((q) => q.id);

  const attribution = podId ? await loadPodAttribution() : null;

  const [core, principleLinks, topicLinks, batchRows] = await Promise.all([
    loadQuestionStats(
      allIds,
      podId && attribution ? { podId, attribution } : undefined,
    ),
    repo.listPrincipleLinksForQuestions(allIds),
    repo.listTopicLinksForQuestions(allIds),
    repo.listBatchesWithResponseCounts(),
  ]);

  // Confusion pairs: every wrong which_principle pick, keyed by what the
  // answer was and what got picked instead.
  const nameByCode = new Map(principleLinks.map((l) => [l.code, l.name]));
  const pairCounts = new Map<string, number>();
  for (const g of core.graded) {
    if (g.grade !== 0 || g.keyCode === null || g.pickedWrongCode === null)
      continue;
    const key = `${g.keyCode}→${g.pickedWrongCode}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  const confusions = [...pairCounts.entries()]
    .map(([pair, count]) => {
      const [keyCode, pickedCode] = pair.split("→");
      return {
        keyCode,
        keyName: nameByCode.get(keyCode) ?? keyCode,
        pickedCode,
        pickedName: nameByCode.get(pickedCode) ?? pickedCode,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  let pod: PodComparison | null = null;
  if (podId && core.pod) {
    pod = {
      podId,
      label: await podLabel(staff, podId),
      responseCount: core.pod.responseCount,
      correct: core.pod.correct,
      total: core.pod.total,
      rubric: buildRubricRows(core.pod.graded, principleLinks),
      topics: buildTopicRows(core.pod.graded, topicLinks),
    };
  }

  return {
    participantCount: core.participantCount,
    responseCount: core.responseCount,
    duplicateCount: core.duplicateCount,
    activity: dailyCounts(core.rawCreatedAts),
    answeredQuestionCount: core.questions.filter((q) => q.responseCount > 0)
      .length,
    questionCount: allIds.length,
    correct: core.correct,
    total: core.total,
    rubric: buildRubricRows(core.graded, principleLinks),
    topics: buildTopicRows(core.graded, topicLinks),
    confusions,
    batches: batchRows.filter((row) => row.responseCount > 0),
    skipped: mergeSkipped(summaries, { skipped: core.skipped }),
    viewerPodScope: podScopeId(staff),
    pod,
    podBreakdown: await buildPodBreakdownRows(
      staff,
      core.rawRows,
      new Map(core.authored.map((q) => [q.id, q])),
    ),
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
  /** Set only for a pod lead viewing their own scope — this route has no
   *  `?pod=` selector (PODS.md: the selector lives on the org dashboard
   *  and the batch report only). */
  pod: QuestionPodReport | null;
  /** Every pod side by side (full-scope viewers only). */
  podBreakdown: PodBreakdownRow[] | null;
};

/** Overall + distribution, pod-scoped — cheap to fold in since grading and
 *  tallying already happened for the project number right beside it. */
export type QuestionPodReport = {
  podId: string;
  label: string;
  responseCount: number;
  correct: number;
  total: number;
  tally: TallyGroup[] | null;
};

export async function getQuestionReport(
  questionId: string,
): Promise<QuestionReport> {
  const staff = await requireStaff();
  const podId = podScopeId(staff);

  const question = await questionsService.getWithKey(questionId);

  const [responses, principleLinks, topicLinks, batchLinks, attribution] =
    await Promise.all([
      repo.listResponsesForQuestions([questionId]),
      repo.listPrincipleLinksForQuestions([questionId]),
      repo.listTopicLinksForQuestions([questionId]),
      repo.listBatchLinksForQuestions([questionId]),
      podId ? loadPodAttribution() : Promise.resolve(null),
    ]);

  const questionsById = new Map([[question.id, question]]);
  const firstAnswers = dedupeToFirstAnswer(responses.rows);
  const graded = gradeResponses(firstAnswers.rows, questionsById);

  const gradeable = graded.filter((g) => g.grade !== null);
  const answers = firstAnswers.rows.map((row) => row.answer);

  let pod: QuestionPodReport | null = null;
  if (podId && attribution) {
    const slice = buildPodSlice(responses.rows, podId, attribution, questionsById);
    pod = {
      podId,
      label: await podLabel(staff, podId),
      responseCount: slice.responseCount,
      correct: slice.correct,
      total: slice.total,
      tally: tallyFor(question, slice.firstAnswers.map((row) => row.answer)),
    };
  }

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
    pod,
    podBreakdown: await buildPodBreakdownRows(staff, responses.rows, questionsById),
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
  /** Set only for a pod lead viewing their own scope (no `?pod=` selector
   *  on this route). */
  pod: PodOverall | null;
  /** Every pod side by side (full-scope viewers only). */
  podBreakdown: PodBreakdownRow[] | null;
};

export async function getTopicReport(slug: string): Promise<TopicReport> {
  const staff = await requireStaff();
  const podId = podScopeId(staff);

  const topic = (await topicsService.listTopics()).find(
    (t) => t.slug === slug,
  );
  if (!topic) throw new AppError("not_found", "No such topic.");

  const questionIds = await repo.listQuestionIdsForTopic(topic.id);
  const attribution = podId ? await loadPodAttribution() : null;

  const [core, batchLinks, principles] = await Promise.all([
    loadQuestionStats(
      questionIds,
      podId && attribution ? { podId, attribution } : undefined,
    ),
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
    pod: await buildPodOverall(staff, podId, core),
    podBreakdown: await buildPodBreakdownRows(
      staff,
      core.rawRows,
      new Map(core.authored.map((q) => [q.id, q])),
    ),
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
  /** Set only for a pod lead viewing their own scope (no `?pod=` selector
   *  on this route). */
  pod: PodOverall | null;
  /** Every pod side by side (full-scope viewers only). */
  podBreakdown: PodBreakdownRow[] | null;
};

export async function getPrincipleReport(
  code: string,
): Promise<PrincipleReport> {
  const staff = await requireStaff();
  const podId = podScopeId(staff);

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

  const attribution = podId ? await loadPodAttribution() : null;

  const [core, batchLinks] = await Promise.all([
    loadQuestionStats(
      keyedIds,
      podId && attribution ? { podId, attribution } : undefined,
    ),
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
    pod: await buildPodOverall(staff, podId, core),
    podBreakdown: await buildPodBreakdownRows(
      staff,
      core.rawRows,
      new Map(core.authored.map((q) => [q.id, q])),
    ),
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
 * The shared middle of the org, topic and principle reports: load questions
 * with keys, load every response org-wide, dedupe to first answers, grade,
 * and fold into overall numbers plus one stat row per question. `podContext`
 * runs the SAME rows through the pod-slice primitive so a pod's number and
 * the project's number beside it always come off one fetch, one grading
 * pass.
 */
async function loadQuestionStats(
  questionIds: string[],
  podContext?: { podId: string; attribution: PodAttribution },
): Promise<{
  responseCount: number;
  participantCount: number;
  duplicateCount: number;
  correct: number;
  total: number;
  questions: QuestionStatRow[];
  /** The parsed questions themselves, for callers that need key codes. */
  authored: AuthoredQuestion[];
  graded: GradedResponse[];
  /** RAW response rows (pre-dedupe) — pod-breakdown material. */
  rawRows: ReportResponseRow[];
  /** RAW response timestamps (pre-dedupe) — activity-chart material. */
  rawCreatedAts: string[];
  skipped: SkippedRow[];
  pod: PodSlice | null;
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

  const pod = podContext
    ? buildPodSlice(
        responses.rows,
        podContext.podId,
        podContext.attribution,
        questionsById,
      )
    : null;

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
    rawRows: responses.rows,
    rawCreatedAts: responses.rows.map((row) => row.createdAt),
    skipped: mergeSkipped(questionsResult, responses),
    pod,
  };
}

/**
 * Raw timestamps → one point per UTC day, gaps filled with zeros so the
 * chart's x-axis is a real timeline rather than only the busy days.
 */
function dailyCounts(createdAts: string[]): DayCount[] {
  if (createdAts.length === 0) return [];

  const counts = new Map<string, number>();
  for (const at of createdAts) {
    const day = at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const days = [...counts.keys()].sort();
  const out: DayCount[] = [];
  const cursor = new Date(`${days[0]}T00:00:00Z`);
  const last = new Date(`${days[days.length - 1]}T00:00:00Z`);
  while (cursor <= last) {
    const day = cursor.toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
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
