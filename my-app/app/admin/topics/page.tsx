import { GhostButton, PageHeader, PrimaryButton } from "@/components/admin/ui";
import { topicCounts } from "@/lib/admin/fixtures";

export default function TopicsPage() {
  const rows = topicCounts();

  return (
    <>
      <PageHeader
        title="Topics"
        meta={`${rows.length} buckets · the shape of the situation, not the failure mode`}
        actions={<PrimaryButton>New topic</PrimaryButton>}
      />

      <div className="flex flex-col gap-4 p-6">
        <p className="max-w-[70ch] rounded-[10px] border border-violet-line bg-violet-tint px-4 py-3 text-[13px] leading-[1.6] text-muted">
          These are placeholders. The design&rsquo;s topic list — overclaiming,
          sycophancy, hedging — was really a list of failure modes, which is
          what the rubric codes are for. Topics are why a question is worth
          asking. Replace these with your real vocabulary before anyone starts
          authoring.
        </p>

        <div className="overflow-hidden rounded-[10px] border border-line">
          <div className="grid grid-cols-[1fr_200px_100px_120px] gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
            <span>LABEL</span>
            <span>SLUG</span>
            <span>QUESTIONS</span>
            <span>ORDER</span>
          </div>
          {rows.map((t) => (
            <div
              key={t.slug}
              className="grid grid-cols-[1fr_200px_100px_120px] items-center gap-0 border-b border-line-3 px-4 py-3 last:border-b-0 transition-colors hover:bg-surface"
            >
              <span className="text-[13.5px] text-ink-3">{t.label}</span>
              <span className="font-mono text-[12.5px] text-muted-2">
                {t.slug}
              </span>
              <span className="text-[12.5px] text-muted-2 tabular-nums">
                {t.count}
              </span>
              <span className="text-[12.5px] text-muted-3 tabular-nums">
                {t.sortOrder}
              </span>
            </div>
          ))}
        </div>

        <div className="flex">
          <GhostButton>Reorder</GhostButton>
        </div>
      </div>
    </>
  );
}
