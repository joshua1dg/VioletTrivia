import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getBatchReport } from "@/lib/services/reports";

import { ScoreBar } from "../score-bar";

/**
 * /admin/reports/[batchId] — the PLAN §8 sketch. `params` is a Promise in
 * this Next version (node_modules/next/dist/docs/01-app — every
 * dynamic-segment example awaits it).
 *
 * A bad id throws `AppError("not_found")` out of `getBatchReport` and is
 * left to propagate to `app/error.tsx`, same reasoning as the question
 * editor's single-item read (PLAN §5.7): this is staff tooling, not a
 * participant-facing 404.
 */
export default async function BatchReportPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const report = await getBatchReport(batchId);

  return (
    <>
      <PageHeader
        title={report.batch.name}
        meta={`${report.participantCount} participant${report.participantCount === 1 ? "" : "s"} · ${report.questionCount} question${report.questionCount === 1 ? "" : "s"}`}
        actions={
          <Link
            href="/admin/reports"
            className="text-[13px] text-muted-2 transition-colors hover:text-ink-3"
          >
            ← All reports
          </Link>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        <Section title="By rubric code">
          {report.rubric.length === 0 ? (
            <p className="text-[13px] text-muted-3">
              No which_principle responses yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {report.rubric.map((row) => (
                <ScoreBar
                  key={row.code}
                  label={`${row.code} — ${row.name}`}
                  correct={row.correct}
                  total={row.total}
                  note={
                    row.mostPickedWrong &&
                    `most-picked wrong: ${row.mostPickedWrong.code}`
                  }
                />
              ))}
            </div>
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
                {report.topics.map((row) => (
                  <ScoreBar
                    key={row.slug}
                    label={row.label}
                    correct={row.correct}
                    total={row.total}
                  />
                ))}
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

        {report.excluded.length > 0 && (
          <div className="rounded-[10px] border border-line bg-surface p-4">
            <p className="text-[13px] text-muted-2">
              {report.excluded.length} write_feedback question
              {report.excluded.length === 1 ? "" : "s"} excluded — prose
              answers have no key to grade against.
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
