import { PageHeader, StatusPill } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getWithKey } from "@/lib/services/questions";
import { getQuestionReport } from "@/lib/services/reports";
import { registry } from "@/lib/templates/registry";

import { QuestionPreview } from "./preview";

import { RateDonutRow, SharePie } from "../../../reports/charts";
import {
  HeaderLink,
  LinkChips,
  PodBreakdownList,
  TallyBars,
} from "../../../reports/report-bits";

/**
 * The question's dashboard — what clicking a question row means now
 * (2026-08-11: "everything goes to a report"). Editing moved behind the
 * explicit button in the header; the editor itself is unchanged at
 * `/admin/questions/[id]`.
 *
 * Numbers are ORG-WIDE: every batch and live session this question has run
 * in, deduped to each participant's first answer.
 */
export default async function QuestionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `getWithKey` rather than `getForReviewer` for the preview: the
  // reviewer read is pinned to approved, and this report must also serve
  // a still-proposed question. The answer key DOES cross to the client
  // here — the preview's reveal needs it — which is fine on this
  // staff-gated page and would not be on any participant surface (see
  // the note in preview.tsx).
  const [report, question] = await Promise.all([
    getQuestionReport(id),
    getWithKey(id),
  ]);
  const q = report.question;

  return (
    <>
      <PageHeader
        title={q.prompt}
        meta={`${registry[q.template].label} · ${report.responseCount} answer${report.responseCount === 1 ? "" : "s"} from ${report.participantCount} participant${report.participantCount === 1 ? "" : "s"}, all batches and sessions`}
        actions={
          <div className="flex items-center gap-2.5">
            <HeaderLink href="/admin/questions">← All questions</HeaderLink>
            <HeaderLink href={`/admin/questions/${q.id}`}>
              Edit question
            </HeaderLink>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={q.status} />
            {report.duplicateCount > 0 && (
              <span className="text-[12px] text-muted-3">
                {report.duplicateCount} repeat answer
                {report.duplicateCount === 1 ? "" : "s"} excluded
              </span>
            )}
          </div>
          {report.keyCode && (
            <LinkChips
              label="Key"
              items={[
                {
                  href: `/admin/principles/${report.keyCode}`,
                  text: report.keyCode,
                },
              ]}
            />
          )}
          <LinkChips
            label="In play"
            items={report.principleCodes
              .filter((code) => code !== report.keyCode)
              .map((code) => ({
                href: `/admin/principles/${code}`,
                text: code,
              }))}
          />
          <LinkChips
            label="Topics"
            items={report.topics.map((topic) => ({
              href: `/admin/topics/${topic.slug}`,
              text: topic.label,
            }))}
          />
          <LinkChips
            label="Appears in"
            items={report.batches.map((batch) => ({
              href: `/admin/batches/${batch.id}/report`,
              text: batch.name,
            }))}
          />
        </div>

        <div className="flex flex-wrap items-start gap-10">
          {(report.total > 0 || (report.pod && report.pod.total > 0)) && (
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[12px] tracking-[0.04em] text-faint">
                CORRECT RATE
              </h2>
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
                <p className="text-[12px] text-muted-3">
                  No pod answers yet.
                </p>
              )}
            </section>
          )}

          <section className="flex min-w-0 flex-1 flex-col gap-2.5">
            <h2 className="text-[12px] tracking-[0.04em] text-faint">
              ANSWER DISTRIBUTION
            </h2>
            {report.tally === null ? (
              <p className="text-[13px] text-muted-3">
                Prose answers — no distribution to chart.
              </p>
            ) : report.responseCount === 0 ? (
              <p className="text-[13px] text-muted-3">No answers yet.</p>
            ) : report.tally.length === 1 ? (
              // One group = an option split (which_principle) — a pie says
              // it faster than bars. Rankings keep the per-position bars;
              // positions don't share a whole to slice.
              <SharePie group={report.tally[0]} />
            ) : (
              <TallyBars groups={report.tally} />
            )}
          </section>
        </div>

        {report.podBreakdown && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-[12px] tracking-[0.04em] text-faint">
              BY POD
            </h2>
            <PodBreakdownList rows={report.podBreakdown} />
          </section>
        )}

        {report.feedback.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[12px] tracking-[0.04em] text-faint">
              WRITTEN FEEDBACK ({report.feedback.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {report.feedback.map((text, index) => (
                <li
                  key={index}
                  className="rounded-[8px] border border-line-3 bg-white px-3 py-2 text-[12.5px] leading-[1.5] text-muted"
                >
                  {text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Below the metrics, full flow: answer → Submit → the real
            Reveal, all in browser memory — nothing writes. Capped at a
            comfortable desktop width; the shell lays itself out from
            its container, so this renders the desktop participant view. */}
        <section className="flex max-w-[880px] flex-col gap-2.5">
          <h2 className="text-[12px] tracking-[0.04em] text-faint">
            AS PARTICIPANTS SEE IT
          </h2>
          <QuestionPreview
            template={question.template}
            content={question.content}
            answerKey={question.answerKey}
            prompt={question.prompt}
          />
        </section>
      </div>
    </>
  );
}
