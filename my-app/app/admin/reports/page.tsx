import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/admin/ui";
import { EmptyState, SkippedRowsBanner } from "@/components/feedback";
import { getOrgReport } from "@/lib/services/reports";

import { ActivityChart, RateDonut } from "./charts";
import { ScoreBar } from "./score-bar";

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
 */
export default async function OrgReportPage() {
  const report = await getOrgReport();

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

        {report.duplicateCount > 0 && (
          <p className="text-[12.5px] text-muted-3">
            {report.duplicateCount} repeat answer
            {report.duplicateCount === 1 ? "" : "s"} excluded — when the same
            person answers the same question more than once (in two batches,
            or async and live), only their first answer counts here.
          </p>
        )}

        <div className="flex flex-wrap gap-6">
          {report.total > 0 && (
            <Section title="Overall">
              <div className="px-4 py-3">
                <RateDonut
                  correct={report.correct}
                  total={report.total}
                  caption={`${report.correct} of ${report.total} correct`}
                />
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

        <Section title="By rubric code">
          {report.rubric.length === 0 ? (
            <p className="text-[13px] text-muted-3">
              No which_principle responses yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {report.rubric.map((row) => (
                  <Link
                    key={row.code}
                    href={`/admin/principles/${row.code}`}
                    className="-mx-2 rounded-[8px] px-2 transition-colors hover:bg-surface"
                  >
                    <ScoreBar
                      label={`${row.code} — ${row.name}`}
                      correct={row.correct}
                      total={row.total}
                      note={
                        row.mostPickedWrong &&
                        `most-picked wrong: ${row.mostPickedWrong.code}`
                      }
                    />
                  </Link>
                ))}
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
              {report.topics.map((row) => (
                <Link
                  key={row.slug}
                  href={`/admin/topics/${row.slug}`}
                  className="-mx-2 rounded-[8px] px-2 transition-colors hover:bg-surface"
                >
                  <ScoreBar
                    label={row.label}
                    correct={row.correct}
                    total={row.total}
                  />
                </Link>
              ))}
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
