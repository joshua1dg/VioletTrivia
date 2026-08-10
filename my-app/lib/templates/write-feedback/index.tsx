import type { ReactNode } from "react";
import { RichText } from "@/components/question/rich-text";
import type {
  RevealProps,
  ReviewProps,
  WriteFeedbackContent,
  WriteFeedbackKey,
} from "@/lib/templates/types";

/* ------------------------------------------------------------------ *
 * T3 — Reviewer feedback
 *
 * A fellow reviewed a completion and wrote a rationale. The reviewer decides
 * for themselves whether it holds and writes their own feedback — there is
 * nothing to pick. The reveal breaks the model answer into three moves.
 *
 * This is the one template whose answer is prose, which means it has no
 * gradeable key and nothing to tally. See the registry.
 * ------------------------------------------------------------------ */

function Label({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted-3">
      {children}
    </span>
  );
}

function Block({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[9px] border border-line bg-surface px-4 py-3.5 text-[13px] leading-[1.6] text-ink-3 @3xl:text-[13.5px]">
      {children}
    </div>
  );
}

export function WriteFeedbackReview({
  content,
  answer,
  onAnswer,
}: ReviewProps<WriteFeedbackContent>) {
  const [request, completion] = content.turns;

  return (
    <div className="flex flex-col gap-4">
      {request && (
        <div className="flex flex-col gap-2">
          <Label>USER REQUEST</Label>
          <Block>
            <RichText body={request.body} />
          </Block>
        </div>
      )}

      {completion && (
        <div className="flex flex-col gap-2">
          <Label>COMPLETION (FINAL ANSWER)</Label>
          <Block>
            <RichText body={completion.body} />
          </Block>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>FELLOW&rsquo;S RATIONALE</Label>
        <Block>{content.subject.rationale}</Block>
      </div>

      <div className="flex flex-col gap-2">
        <Label>FEEDBACK</Label>
        <textarea
          value={answer.feedback ?? ""}
          onChange={(e) => onAnswer({ feedback: e.target.value })}
          rows={4}
          placeholder="Write feedback for this fellow…"
          className="min-h-24 resize-y rounded-[9px] border border-dashed border-line-4 bg-white px-4 py-3.5 text-[13px] leading-[1.6] text-ink-3 outline-none transition-colors focus:border-violet-line focus:border-solid @3xl:text-[13.5px]"
        />
      </div>
    </div>
  );
}

const MOVES = [
  {
    n: 1,
    label: "WHAT'S WORKING",
    key: "working" as const,
    shell: "border-ok-line bg-ok-tint",
    dot: "bg-ok",
    text: "text-ok-ink",
  },
  {
    n: 2,
    label: "WHAT NEEDS CORRECTING, AND WHY",
    key: "correcting" as const,
    shell: "border-warn-line bg-warn-tint",
    dot: "bg-warn",
    text: "text-warn-ink",
  },
  {
    n: 3,
    label: "HOW TO IMPROVE",
    key: "improve" as const,
    shell: "border-violet-line bg-violet-tint",
    dot: "bg-violet",
    text: "text-violet-deep",
  },
];

export function WriteFeedbackReveal({
  answerKey,
  answer,
}: RevealProps<WriteFeedbackContent, WriteFeedbackKey>) {
  const weak = answerKey.verdictTone === "weak";
  // There is no key to compare against here (grade is null), so the
  // participant's own prose sits beside the exemplar and the comparison is
  // theirs to make — the same "here's yours, here's the model's" move the
  // other two reveals make with a pick and an order.
  const yours = answer.feedback?.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex">
        <span
          className={`flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium ${
            weak
              ? "border-warn-line bg-warn-tint text-warn-ink"
              : "border-ok-line bg-ok-tint text-ok-ink"
          }`}
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${weak ? "bg-warn" : "bg-ok"}`}
          />
          {answerKey.verdict}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {MOVES.map((move) => (
          <div
            key={move.n}
            className={`flex flex-col gap-2.5 rounded-[11px] border p-4 ${move.shell}`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex size-[19px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold text-white ${move.dot}`}
              >
                {move.n}
              </span>
              <span
                className={`text-[11.5px] font-semibold tracking-[0.08em] ${move.text}`}
              >
                {move.label}
              </span>
            </div>
            <p className="text-[13px] leading-[1.6] text-ink-3 @3xl:text-[13.5px]">
              {answerKey.blocks[move.key]}
            </p>
          </div>
        ))}
      </div>

      <div className="h-px bg-line-2" />

      {yours && (
        <div className="flex flex-col gap-2">
          <Label>YOUR FEEDBACK</Label>
          <div className="rounded-[10px] border border-line bg-surface px-4 py-4 text-[13px] leading-[1.7] whitespace-pre-wrap text-ink-3 @3xl:text-[13.5px]">
            {yours}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>FEEDBACK THAT LANDS</Label>
        <div className="rounded-[10px] border border-line bg-surface px-4 py-4 text-[13px] leading-[1.7] text-ink-4 italic @3xl:text-[13.5px]">
          {answerKey.exemplar}
        </div>
        {answerKey.toneNote && (
          <p className="text-[12.5px] leading-[1.55] text-muted-3">
            {answerKey.toneNote}
          </p>
        )}
      </div>
    </div>
  );
}
