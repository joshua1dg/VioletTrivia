import { Excerpt } from "@/components/question/excerpt";
import { OptionCard } from "@/components/question/shell";
import { WhyNote } from "@/components/question/why-note";
import type {
  Answer,
  WhichPrincipleContent,
  WhichPrincipleKey,
} from "@/lib/templates/types";

/* ------------------------------------------------------------------ *
 * T1 — Principles, side by side
 *
 * Two rubric codes are put in play, one excerpt is shown, and the reviewer
 * decides which code the excerpt should be judged under. Both are arguable;
 * the point is which one it actually fails.
 *
 * These components render the BODY only. The surrounding chrome — header,
 * progress, footer button — belongs to QuestionShell so it stays identical
 * across templates.
 * ------------------------------------------------------------------ */

export function WhichPrincipleReview({
  content,
  prompt,
  answer,
  onAnswer,
  note,
  onNote,
}: {
  content: WhichPrincipleContent;
  prompt: string;
  answer: Answer;
  onAnswer: (next: Answer) => void;
  note: string;
  onNote: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <span className="text-[12.5px] font-medium text-muted-3">
          The two principles in play
        </span>
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          {content.inPlay.map((p) => (
            <div
              key={p.code}
              className="flex gap-3.5 rounded-[10px] border border-violet-line bg-violet-tint p-4"
            >
              <span className="mt-0.5 shrink-0 font-mono text-[12px] text-violet-ink">
                {p.code}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink @3xl:text-[15px]">
                  {p.name}
                </span>
                <span className="text-[12.5px] leading-[1.5] text-muted @3xl:text-[13px]">
                  {p.descriptor}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Excerpt turns={content.turns} variant="separate" />

      <p className="text-[14px] font-medium text-ink-3 @3xl:text-[16px]">
        {prompt}
      </p>

      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
        {content.options.map((opt) => {
          const principle = content.inPlay.find(
            (p) => p.code === opt.principleCode,
          );
          const selected = answer.option === opt.id;
          return (
            <OptionCard
              key={opt.id}
              selected={selected}
              onSelect={() => onAnswer({ option: opt.id })}
            >
              <span className="flex flex-col gap-1">
                <span
                  className={`text-[13.5px] font-semibold @3xl:text-[15px] ${
                    selected ? "text-violet-ink" : "text-ink-4"
                  }`}
                >
                  {opt.principleCode} — {principle?.name}
                </span>
                <span className="text-[12px] leading-[1.5] text-muted @3xl:text-[13px]">
                  {opt.subtext}
                </span>
              </span>
            </OptionCard>
          );
        })}
      </div>

      <WhyNote value={note} onChange={onNote} />
    </div>
  );
}

export function WhichPrincipleReveal({
  content,
  answerKey,
}: {
  content: WhichPrincipleContent;
  answerKey: WhichPrincipleKey;
  answer: Answer;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
        {content.options.map((opt) => {
          const isKey = opt.principleCode === answerKey.key;
          const paragraphs = answerKey.perOption[opt.principleCode] ?? [];
          return (
            <div
              key={opt.id}
              className={`overflow-hidden rounded-[11px] border ${
                isKey
                  ? "border-ok-line bg-ok-tint"
                  : "border-line bg-surface"
              }`}
            >
              <div
                className={`flex items-center gap-2.5 border-b px-4 py-3 ${
                  isKey ? "border-ok-line" : "border-line-2"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-4 shrink-0 rounded-full ${
                    isKey ? "bg-ok" : "border-[1.5px] border-dot"
                  }`}
                />
                <span
                  className={`text-[13.5px] font-semibold @3xl:text-[14px] ${
                    isKey ? "text-ok-ink" : "text-muted"
                  }`}
                >
                  {opt.principleCode} —{" "}
                  {isKey ? "the better fit" : "not the issue here"}
                </span>
              </div>
              <div className="flex flex-col gap-2.5 p-4">
                {paragraphs.map((text, i) => (
                  <p
                    key={i}
                    className={`text-[13px] leading-[1.6] @3xl:text-[14px] ${
                      i === 0 ? "text-ink-3" : "text-muted"
                    }`}
                  >
                    {text}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {answerKey.distinguish && (
        <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-4">
          <span className="text-[13px] font-medium text-ink-3">
            {answerKey.distinguish.title}
          </span>
          <p className="text-[13px] leading-[1.6] text-muted @3xl:text-[14px]">
            {answerKey.distinguish.body}
          </p>
        </div>
      )}
    </div>
  );
}
