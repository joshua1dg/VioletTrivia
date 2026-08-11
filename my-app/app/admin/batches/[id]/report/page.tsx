import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getBatchReport, listPodOptions } from "@/lib/services/reports";

import { ActivityChart, RateDonutRow } from "../../../reports/charts";
import {
  HeaderLink,
  PodBreakdownList,
  PodSelector,
  QuestionStatTable,
} from "../../../reports/report-bits";
import { ScoreBarPair } from "../../../reports/score-bar";

/**
 * The batch's dashboard, at home in the batches section (2026-08-11: a
 * batch row clicks through to its report the way every other entity does,
 * WITHOUT leaving `/admin/batches`; `/admin/reports/[batchId]` redirects
 * here). The composer stays at `/admin/batches/[id]`, behind Edit — the
 * same split as questions.
 *
 * Numbers are BATCH-scoped: only answers given through this batch (async
 * via its link, or live sessions run off it), deduped to first answers.
 * The per-question rows click through to each question's ORG-WIDE report.
 *
 * Wave 1 (PODS.md): same pod-vs-project comparison as the org dashboard,
 * scoped to just this batch's answers.
 */
export default async function BatchReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pod?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [report, podOptions] = await Promise.all([
    getBatchReport(id, query.pod),
    listPodOptions(),
  ]);

  return (
    <>
      <PageHeader
        title={report.batch.name}
        meta={`${report.participantCount} participant${report.participantCount === 1 ? "" : "s"} · ${report.questionCount} question${report.questionCount === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2.5">
            <HeaderLink href="/admin/batches">← All batches</HeaderLink>
            <HeaderLink href={`/admin/batches/${report.batch.id}`}>
              Edit batch
            </HeaderLink>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        {report.viewerPodScope === null && (
          <PodSelector
            options={podOptions}
            activePodId={report.pod?.podId ?? null}
            basePath={`/admin/batches/${report.batch.id}/report`}
          />
        )}

        {report.duplicateCount > 0 && (
          <p className="text-[12.5px] text-muted-3">
            {report.duplicateCount} repeat answer
            {report.duplicateCount === 1 ? "" : "s"} excluded — when the same
            person answers the same question more than once (async and live,
            or across sessions), only their first answer counts.
          </p>
        )}

        <div className="flex flex-wrap gap-6">
          {(report.total > 0 || (report.pod && report.pod.total > 0)) && (
            <Section title="Overall">
              <div className="px-4 py-3">
                <RateDonutRow
                  items={[
                    ...(report.total > 0
                      ? [
                          {
                            label: "Project",
                            correct: report.correct,
                            total: report.total,
                            caption: `${report.correct} of ${report.total} correct`,
                          },
                        ]
                      : []),
                    ...(report.pod && report.pod.total > 0
                      ? [
                          {
                            label: report.pod.label,
                            correct: report.pod.correct,
                            total: report.pod.total,
                            caption: `${report.pod.correct} of ${report.pod.total} correct`,
                          },
                        ]
                      : []),
                  ]}
                />
                {report.pod && report.pod.responseCount === 0 && (
                  <p className="mt-2 text-[12px] text-muted-3">
                    No pod answers yet.
                  </p>
                )}
              </div>
            </Section>
          )}
          {report.activity.length > 0 && (
            <div className="min-w-64 flex-1">
              <Section title="Answers per day">
                <div className="py-2">
                  <ActivityChart points={report.activity} />
                </div>
              </Section>
            </div>
          )}
        </div>

        {report.podBreakdown && (
          <Section title="By pod">
            <PodBreakdownList
              rows={report.podBreakdown}
              basePath={`/admin/batches/${report.batch.id}/report`}
            />
            <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
              Each pod&rsquo;s slice of this batch&rsquo;s answers, best rate
              first — click a pod for its full breakdown.
            </p>
          </Section>
        )}

        <Section title="By rubric code">
          {report.rubric.length === 0 ? (
            <p className="text-[13px] text-muted-3">
              No which_principle responses yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {/* Each bar links to the code's own report — every fact on
                    a report is a door (2026-08-11). */}
                {report.rubric.map((row) => {
                  const podRow = report.pod?.rubric.find(
                    (r) => r.code === row.code,
                  );
                  return (
                    <Link
                      key={row.code}
                      href={`/admin/principles/${row.code}`}
                      className="-mx-2 rounded-[8px] px-2 transition-colors hover:bg-surface"
                    >
                      <ScoreBarPair
                        label={`${row.code} — ${row.name}`}
                        project={{ correct: row.correct, total: row.total }}
                        pod={
                          podRow && report.pod
                            ? {
                                label: report.pod.label,
                                correct: podRow.correct,
                                total: podRow.total,
                              }
                            : null
                        }
                        note={
                          row.mostPickedWrong &&
                          `most-picked wrong: ${row.mostPickedWrong.code}`
                        }
                      />
                    </Link>
                  );
                })}
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
                A code&rsquo;s bar counts only the questions it was the
                ANSWER to — a miss debits the code being tested, not every
                code that appeared as an option.
              </p>
            </>
          )}
        </Section>

        <Section title="By topic">
          {report.topics.length === 0 ? (
            <p className="text-[13px] text-muted-3">
              No gradeable responses yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {report.topics.map((row) => {
                  const podRow = report.pod?.topics.find(
                    (t) => t.slug === row.slug,
                  );
                  return (
                    <Link
                      key={row.slug}
                      href={`/admin/topics/${row.slug}`}
                      className="-mx-2 rounded-[8px] px-2 transition-colors hover:bg-surface"
                    >
                      <ScoreBarPair
                        label={row.label}
                        project={{ correct: row.correct, total: row.total }}
                        pod={
                          podRow && report.pod
                            ? {
                                label: report.pod.label,
                                correct: podRow.correct,
                                total: podRow.total,
                              }
                            : null
                        }
                      />
                    </Link>
                  );
                })}
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
                Includes rank_variants responses, graded exact-match. A low
                bar on a topic that&rsquo;s mostly rank_variants questions
                reflects that template&rsquo;s 1-in-24 chance floor, not
                necessarily miscalibration — see the rubric axis above for
                the calibration signal proper.
              </p>
            </>
          )}
        </Section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink-3">
            By question
          </h2>
          <QuestionStatTable rows={report.questions} />
          <p className="text-[12px] leading-[1.5] text-muted-3">
            Counts here are this batch&rsquo;s answers only; a question&rsquo;s
            row opens its org-wide report.
          </p>
        </section>

        {report.excluded.length > 0 && (
          <div className="rounded-[10px] border border-line bg-surface p-4">
            <p className="text-[13px] text-muted-2">
              {report.excluded.length} write_feedback question
              {report.excluded.length === 1 ? "" : "s"} excluded from grading
              — prose answers have no key to grade against.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-[12.5px] text-violet-ink hover:text-violet-deep">
                Read the responses →
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                {report.excluded.map((question) => (
                  <div key={question.id} className="flex flex-col gap-1.5">
                    <p className="text-[12.5px] font-medium text-ink-3">
                      {question.prompt}
                    </p>
                    {question.responses.length === 0 ? (
                      <p className="text-[12px] text-faint">
                        No responses yet.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {question.responses.map((response, index) => (
                          <li
                            key={index}
                            className="rounded-[8px] border border-line-3 bg-white px-3 py-2 text-[12.5px] leading-[1.5] text-muted"
                          >
                            {response.feedback}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink-3">
        {title}
      </h2>
      <div className="rounded-[10px] border border-line bg-white px-4 py-2">
        {children}
      </div>
    </section>
  );
}
