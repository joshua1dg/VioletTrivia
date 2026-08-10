import type { Turn } from "@/lib/templates/types";
import { RichText } from "./rich-text";

const ROLE_LABEL: Record<Turn["role"], string> = {
  user: "USER",
  assistant: "ASSISTANT",
};

/**
 * One palette per role, so the alternation is legible before a single word is
 * read. The assistant takes the violet because the assistant's turn is the
 * thing under judgement — every other assistant accent in the app already
 * points that way (the authoring role toggle, the old label colour). The user
 * turn is deliberately neutral: it's context, not the subject.
 *
 * `rule` and `edge` are separate because a card sitting on white needs a
 * stronger border than a divider drawn between two filled rows, and because
 * the side-specific `border-t-*`/`border-l-*` colour utilities never collide
 * with the all-sides `border-*` one the way a shared token would.
 *
 * Body text is `ink-3` for BOTH roles. It used to be dimmer for the user, and
 * that was the wrong lever — these are long transcripts read under time
 * pressure, so the fill carries the distinction and the text stays readable.
 */
const ROLE_STYLE = {
  user: {
    fill: "bg-canvas",
    rail: "border-l-faint-2",
    edge: "border-line-4",
    rule: "border-t-line",
    chip: "bg-muted text-white",
  },
  assistant: {
    fill: "bg-violet-tint-3",
    rail: "border-l-violet",
    edge: "border-violet-line-2",
    rule: "border-t-violet-line-2",
    chip: "bg-violet text-white",
  },
} satisfies Record<Turn["role"], Record<string, string>>;

function Label({ role }: { role: Turn["role"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[4px] px-1.5 py-[3px] font-mono text-[10px] leading-none font-medium tracking-[0.08em] ${ROLE_STYLE[role].chip}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

/**
 * The conversation being judged.
 *
 * `separate` gives each turn its own card with the assistant's meta in a
 * header bar — that's T1, `which_principle`. `grouped` puts them in one card
 * divided by rules, which is T2, `rank_variants`. Same data either way, and
 * the same role colouring either way.
 */
export function Excerpt({
  turns,
  variant = "grouped",
}: {
  turns: Turn[];
  variant?: "separate" | "grouped";
}) {
  if (variant === "separate") {
    return (
      <div className="flex flex-col gap-3">
        {turns.map((turn, i) => {
          const style = ROLE_STYLE[turn.role];
          return (
            <div
              key={i}
              className={`overflow-hidden rounded-[10px] border border-l-[3px] ${style.edge} ${style.rail} ${style.fill}`}
            >
              <div
                className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${style.edge}`}
              >
                <Label role={turn.role} />
                {turn.meta && (
                  <span className="text-[11.5px] text-muted">{turn.meta}</span>
                )}
              </div>
              <div className="px-4 py-3.5 text-[14px] leading-[1.6] text-ink-3 @3xl:text-[15px]">
                <RichText body={turn.body} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      {turns.map((turn, i) => {
        const style = ROLE_STYLE[turn.role];
        return (
          <div
            key={i}
            className={`flex flex-col gap-1.5 border-l-[3px] px-4 py-3.5 ${style.rail} ${style.fill} ${
              i > 0 ? `border-t ${style.rule}` : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <Label role={turn.role} />
              {turn.meta && (
                <span className="text-[11.5px] text-muted">{turn.meta}</span>
              )}
            </div>
            <div className="text-[13.5px] leading-[1.6] text-ink-3 @3xl:text-[14px]">
              <RichText body={turn.body} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
