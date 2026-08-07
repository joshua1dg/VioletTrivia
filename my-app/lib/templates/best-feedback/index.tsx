import { CodeChip, Excerpt } from "@/components/question/excerpt";
import { OptionCard } from "@/components/question/shell";
import type {
  BestFeedbackContent,
  BestFeedbackKey,
  RevealProps,
  ReviewProps,
} from "@/lib/templates/types";

/* ------------------------------------------------------------------ *
 * T3 — Practice writing feedback
 *
 * A fellow reviewed a completion and wrote a rationale, invoking some rubric
 * codes. One of those calls is wrong. The reviewer picks which of four
 * responses would actually help them.
 *
 * Two columns on a desktop — the rationale under review on the left, the
 * choices on the right — collapsing to one stacked column on a phone in
 * exactly that order.
 * ------------------------------------------------------------------ */

export function BestFeedbackReview({
  content,
  prompt,
  answer,
  onAnswer,
}: ReviewProps<BestFeedbackContent>) {
  return (
    <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2 @3xl:gap-8">
      <div className="flex flex-col gap-4">
        <span className="text-[12.5px] font-medium text-muted-3">
          The rationale being reviewed
        </span>

        <Excerpt turns={content.turns} />

        <div className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-surface px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-ink-3">
              Fellow&rsquo;s rationale
            </span>
            <div className="flex shrink-0 gap-1.5">
              {content.subject.calls.map((call) => (
                <CodeChip
                  key={call.code}
                  code={call.code}
                  verdict={call.verdict}
                />
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-[1.6] text-muted @3xl:text-[13.5px]">
            {content.subject.rationale}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[14px] font-medium text-ink-3 @3xl:text-[16px]">
          {prompt}
        </p>
        <div className="flex flex-col gap-2.5">
          {content.options.map((opt) => (
            <OptionCard
              key={opt.id}
              selected={answer.option === opt.id}
              onSelect={() => onAnswer({ option: opt.id })}
            >
              <span className="block text-[13px] leading-[1.6] text-ink-3 @3xl:text-[13.5px]">
                {opt.body}
              </span>
            </OptionCard>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BestFeedbackReveal({
  content,
  answerKey,
  answer,
}: RevealProps<BestFeedbackContent, BestFeedbackKey>) {
  const picked = content.options.find((o) => o.id === answer.option);
  const strongest = content.options.find((o) => o.id === answerKey.key);

  return (
    <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2 @3xl:gap-8">
      <div className="flex flex-col gap-4">
        {picked && (
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-medium text-muted-3">
              Your pick
            </span>
            <div className="rounded-[10px] border border-line bg-surface px-4 py-3.5 text-[13px] leading-[1.6] text-ink-3 @3xl:text-[13.5px]">
              {picked.body}
            </div>
          </div>
        )}

        {strongest && (
          <div className="flex flex-col gap-2.5 rounded-[11px] border border-ok-line bg-ok-tint px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="size-3 shrink-0 rounded-full bg-ok" />
              <span className="text-[13.5px] font-semibold text-ok-ink">
                Strongest feedback
              </span>
            </div>
            <p className="text-[13px] leading-[1.6] text-ink-3 @3xl:text-[13.5px]">
              {strongest.body}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[12.5px] font-medium text-muted-3">
          What makes it strong
        </span>
        <ul className="flex flex-col gap-3">
          {answerKey.bullets.map((b) => (
            <li key={b.label} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ok"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-ink-3 @3xl:text-[13.5px]">
                  {b.label}
                </span>
                <span className="text-[12.5px] leading-[1.55] text-muted @3xl:text-[13px]">
                  {b.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
