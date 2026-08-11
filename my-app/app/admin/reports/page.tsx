import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/admin/ui";
import { EmptyState, SkippedRowsBanner } from "@/components/feedback";
import { getOrgReport, listPodOptions } from "@/lib/services/reports";

import { ActivityChart, RateDonutRow } from "./charts";
import { PodBreakdownList, PodSelector } from "./report-bits";
import { ScoreBarPair } from "./score-bar";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
};

/**
 * /admin/reports — the ORG-WIDE dashboard (2026-08-11). Once every batch
 * row linked to its own report, the old batch list here was redundant;
 * what was missing was the unscoped view: where is the team miscalibrated
 * across everything. Every bar, chip and row below links into the entity
 * reports, same as everywhere else.
 *
 * Wave 1 (PODS.md): a pod lead's slice renders beside these project-wide
 * numbers automatically; a project lead/admin picks a pod via `?pod=` and
 * sees the exact same comparison.
 */
export default async function OrgReportPage({
  searchParams,
}: {
  searchParams: Promise<{ pod?: string }>;
}) {
  const params = await searchParams;
  const [report, podOptions] = await Promise.all([
    getOrgReport(params.pod),
    listPodOptions(),
  ]);

  if (report.responseCount === 0) {
    return (
      <>
        <PageHeader
          title="Reports"
          meta="Where the team is miscalibrated — org-wide, across every batch"
        />
        <div className="p-6">
          <EmptyState title="No responses yet">
            Reports need at least one answer somewhere — async or live. Once
            one comes in, this becomes the org-wide dashboard, and each
            batch, question, topic and rubric code gets its own report.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports"
        meta={`Org-wide · ${report.participantCount} participant${report.participantCount === 1 ? "" : "s"} · ${report.responseCount} answer${report.responseCount === 1 ? "" : "s"} · ${report.answeredQuestionCount} of ${report.questionCount} questions answered`}
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        {report.viewerPodScope === null && (
          <PodSelector
            options={podOptions}
            activePodId={report.pod?.podId ?? null}
            basePath="/admin/reports"
          />
        )}

        {report.duplicateCount > 0 && (
          <p className="text-[12.5px] text-muted-3">
            {report.duplicateCount} repeat answer
            {report.duplicateCount === 1 ? "" : "s"} excluded — when the same
            person answers the same question more than once (in two batches,
            or async and live), only their first answer counts here.
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
              basePath="/admin/reports"
            />
            <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
              Each pod&rsquo;s slice of the same answers, best rate first —
              click a pod for its full breakdown.
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
                ANSWER to, across every batch and session.
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
          )}
        </Section>

        {report.confusions.length > 0 && (
          <Section title="Top confusions">
            <div className="flex flex-col">
              {report.confusions.map((pair) => (
                <div
                  key={`${pair.keyCode}-${pair.pickedCode}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-[13px]"
                >
                  <span className="w-8 shrink-0 text-right text-[12.5px] tabular-nums text-muted-2">
                    {pair.count}×
                  </span>
                  <span className="text-muted-2">answer was</span>
                  <Link
                    href={`/admin/principles/${pair.keyCode}`}
                    className="font-medium text-ink-3 hover:text-violet-ink hover:underline"
                  >
                    {pair.keyCode} {pair.keyName}
                  </Link>
                  <span className="text-muted-2">— picked</span>
                  <Link
                    href={`/admin/principles/${pair.pickedCode}`}
                    className="font-medium text-ink-3 hover:text-violet-ink hover:underline"
                  >
                    {pair.pickedCode} {pair.pickedName}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
              Every wrong which_principle pick, paired key-to-picked and
              ranked. These are the distinctions worth teaching next.
            </p>
          </Section>
        )}

        <Section title="By batch">
          <div className="-mx-4 -my-2 overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_140px] items-center gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
              <span>BATCH</span>
              <span>STATUS</span>
              <span>RESPONSES</span>
            </div>
            {report.batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/admin/batches/${batch.id}/report`}
                className="grid grid-cols-[1fr_120px_140px] items-center gap-0 border-b border-line-3 px-4 py-3 text-[13.5px] text-ink-3 transition-colors last:border-b-0 hover:bg-surface"
              >
                <span className="truncate">{batch.name}</span>
                <span className="text-[12.5px] text-muted-2">
                  {STATUS_LABEL[batch.status] ?? batch.status}
                </span>
                <span className="tabular-nums text-muted-2">
                  {batch.responseCount} response
                  {batch.responseCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </Section>
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
