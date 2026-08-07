import { Excerpt } from "@/components/question/excerpt";
import type {
  RankVariantsContent,
  RankVariantsKey,
  RevealProps,
  ReviewProps,
} from "@/lib/templates/types";

/* ------------------------------------------------------------------ *
 * T2 — Language breakdown, rank the completions
 *
 * Four replies that promise the same change, differing only in delivery.
 * Move them until the best communication is on top.
 *
 * Reordering is a pair of arrow buttons rather than drag. That removes the
 * whole pointer/touch/keyboard problem: buttons are already focusable, work
 * identically on a phone and a laptop, and can't be confused with a scroll
 * gesture. It also means this component holds no state and needs no hooks.
 *
 * The controls sit left of the rank badge when the card is wide and at the
 * far right on a phone; the structural note is dropped on a phone. Both are
 * ordering classes, not a second component.
 * ------------------------------------------------------------------ */

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 10 6"
      width="10"
      height="6"
      aria-hidden
      className={dir === "down" ? "rotate-180" : undefined}
    >
      <path
        d="M1 5L5 1l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoveControls({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (to: number) => void;
}) {
  const base =
    "flex h-4 w-6 items-center justify-center rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet";
  const enabled = "cursor-pointer text-muted-3 hover:bg-line-3 hover:text-ink-4";
  const disabled = "cursor-not-allowed text-line-4";

  return (
    <span className="flex shrink-0 flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onMove(index - 1)}
        disabled={index === 0}
        aria-label={`Move up to position ${index}`}
        className={`${base} ${index === 0 ? disabled : enabled}`}
      >
        <Chevron dir="up" />
      </button>
      <button
        type="button"
        onClick={() => onMove(index + 1)}
        disabled={index === total - 1}
        aria-label={`Move down to position ${index + 2}`}
        className={`${base} ${index === total - 1 ? disabled : enabled}`}
      >
        <Chevron dir="down" />
      </button>
    </span>
  );
}

function RankBadge({
  rank,
  tone,
}: {
  rank: number;
  tone: "lead" | "rest" | "correct";
}) {
  const bg =
    tone === "lead"
      ? "bg-violet text-white"
      : tone === "correct"
        ? "bg-ok text-white"
        : "bg-line-3 text-muted";
  return (
    <span
      className={`flex size-[22px] shrink-0 items-center justify-center rounded-md text-[12px] font-semibold @3xl:size-[26px] @3xl:rounded-[7px] @3xl:text-[13px] ${bg}`}
    >
      {rank}
    </span>
  );
}

export function RankVariantsReview({
  content,
  prompt,
  answer,
  onAnswer,
}: ReviewProps<RankVariantsContent>) {
  const order = answer.order ?? content.options.map((o) => o.id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = order.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    onAnswer({ order: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <Excerpt turns={content.turns} />

      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-medium text-ink-3 @3xl:text-[16px]">
          {prompt}
        </p>
        {content.subhead && (
          <p className="text-[12.5px] text-muted-3 @3xl:text-[13px]">
            {content.subhead}
          </p>
        )}
      </div>

      {/* Keyed by POSITION, not by variant id, and that is deliberate.
          Keying by id makes React relocate the moved row's DOM node, and the
          browser keeps :hover on the element it was on — so the highlight
          travels with the card instead of staying under the cursor. Because
          React always moves the same single node, that shows up on the up
          arrow but not the down one. Keying by position means no node ever
          moves; only the text inside changes, and hover stays put.
          Safe here only because these rows hold no state of their own. */}
      <ul className="flex flex-col gap-2.5">
        {order.map((id, index) => {
          const variant = content.options.find((o) => o.id === id);
          if (!variant) return null;
          return (
            <li
              key={index}
              className="flex items-start gap-3 rounded-[11px] border border-line bg-white p-3.5 @3xl:gap-4 @3xl:p-4"
            >
              <span className="flex shrink-0 items-center gap-3">
                <span className="hidden @3xl:block">
                  <MoveControls
                    index={index}
                    total={order.length}
                    onMove={(to) => move(index, to)}
                  />
                </span>
                <RankBadge rank={index + 1} tone={index === 0 ? "lead" : "rest"} />
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[12.5px] leading-[1.55] text-ink-3 @3xl:text-[15px]">
                  {variant.body}
                </span>
                <span className="hidden text-[12.5px] text-muted-3 @3xl:block">
                  {variant.note}
                </span>
              </span>

              <span className="@3xl:hidden">
                <MoveControls
                  index={index}
                  total={order.length}
                  onMove={(to) => move(index, to)}
                />
              </span>
            </li>
          );
        })}
      </ul>

    </div>
  );
}

export function RankVariantsReveal({
  content,
  answerKey,
  answer,
}: RevealProps<RankVariantsContent, RankVariantsKey>) {
  const yours = answer.order ?? content.options.map((o) => o.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium text-ink-3 @3xl:text-[16px]">
          Where the room landed
        </span>
        <span className="text-[12.5px] text-muted-3">your order compared</span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {answerKey.keyOrder.map((id, index) => {
          const variant = content.options.find((o) => o.id === id);
          if (!variant) return null;
          const yourRank = yours.indexOf(id) + 1;
          const agreed = yourRank === index + 1;
          return (
            <li
              key={id}
              className={`flex items-start gap-3 rounded-[11px] border p-3.5 @3xl:gap-4 @3xl:p-4 ${
                index === 0 ? "border-ok-line bg-ok-tint" : "border-line bg-white"
              }`}
            >
              <RankBadge
                rank={index + 1}
                tone={index === 0 ? "correct" : "rest"}
              />

              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[12.5px] leading-[1.55] text-ink-3 @3xl:text-[15px]">
                  {variant.body}
                </span>
                <span className="hidden text-[12.5px] text-muted @3xl:block">
                  {variant.note}
                </span>
              </span>

              <span
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[11.5px] whitespace-nowrap ${
                  agreed
                    ? "border-ok-line text-ok-ink"
                    : "border-line text-muted-2"
                }`}
              >
                {agreed ? "You agreed" : `You had it ${yourRank}`}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-4">
        <span className="text-[13px] font-medium text-ink-3">
          {answerKey.rationaleTitle ?? "Why the top one wins"}
        </span>
        <p className="text-[13px] leading-[1.6] text-muted @3xl:text-[14px]">
          {answerKey.rationale}
        </p>
      </div>
    </div>
  );
}
