import type { ComponentType } from "react";
import type { ZodType } from "zod";
import type {
  Answer,
  AuthorProps,
  RankVariantsContent,
  RankVariantsContentStored,
  RankVariantsKey,
  RevealProps,
  ReviewProps,
  TallyGroup,
  TallyRow,
  TemplateKey,
  WhichPrincipleContent,
  WhichPrincipleContentStored,
  WhichPrincipleKey,
  WriteFeedbackContent,
  WriteFeedbackContentStored,
  WriteFeedbackKey,
} from "./types";

import {
  whichPrincipleAnswerKey,
  whichPrincipleContentStored,
} from "./which-principle/schema";
import {
  rankVariantsAnswerKey,
  rankVariantsContentStored,
} from "./rank-variants/schema";
import {
  writeFeedbackAnswerKey,
  writeFeedbackContentStored,
} from "./write-feedback/schema";

import { WhichPrincipleReveal, WhichPrincipleReview } from "./which-principle";
import {
  WhichPrincipleAuthor,
  emptyWhichPrinciple,
} from "./which-principle/author";
import { RankVariantsReveal, RankVariantsReview } from "./rank-variants";
import { RankVariantsAuthor, emptyRankVariants } from "./rank-variants/author";
import { WriteFeedbackReveal, WriteFeedbackReview } from "./write-feedback";
import { WriteFeedbackAuthor, emptyWriteFeedback } from "./write-feedback/author";

/**
 * Everything that varies by template, in one object per template.
 *
 * The payoff is that nothing else in the app branches on `template`. The
 * reviewer page looks up `Review`, the admin editor looks up `Author`, the
 * results page looks up `tally`. Adding a fourth template is a folder and
 * one entry here — and because the enum drives `TemplateKey`, the project
 * stops compiling until that entry exists.
 *
 * Three parameters, because two of them are two different content shapes:
 *
 *   C        the HYDRATED content the components take
 *   K        the answer key
 *   CStored  what actually sits in `questions.content`, which is what gets
 *            validated at the authoring/API boundary
 *
 * They differ for `which_principle` only (PLAN §5.12); the other two are
 * passthrough and pass the same type twice. `CStored` defaults to `unknown`
 * rather than to `C` so that a caller naming only `<C, K>` — the admin
 * editor's generic `TemplateSection` does exactly this — still accepts every
 * registry entry: it holds a validator whose output it has chosen not to
 * name. Defaulting to `C` would make `QuestionTemplate<Hydrated, Key>` reject
 * the T1 entry, and the only way out of that is a cast.
 */
export type QuestionTemplate<C, K, CStored = unknown> = {
  key: TemplateKey;
  label: string;
  blurb: string;

  Review: ComponentType<ReviewProps<C>>;
  Reveal: ComponentType<RevealProps<C, K>>;
  Author: ComponentType<AuthorProps<C, K>>;

  /** A blank question of this shape, for the New question screen. */
  empty: () => { content: C; answerKey: K };

  /**
   * Runtime validation at the authoring and API boundary, and on the way out
   * of the database — `content` and `answer_key` are untyped jsonb and the
   * only place the generated types can lie (PLAN §5.7).
   *
   * `content` validates the STORED shape. Hydration happens after parsing,
   * in `lib/services/questions/hydrate.util.ts`.
   */
  parse: { content: ZodType<CStored>; answerKey: ZodType<K> };

  /**
   * Which rubric codes this question exercises — DERIVED from the content,
   * never picked separately. The codes are already named inside the question
   * (the two in play, the calls a fellow made), so a second picker would be a
   * second source of truth that can disagree with the first.
   *
   * This is what writes question_principles on save.
   */
  principleCodes: (content: C) => string[];

  /**
   * 0 or 1, computed at read time and never stored — or `null` where the
   * template has no gradeable answer. write_feedback takes prose, so there is
   * nothing to compare a key against; anything that scores must skip it
   * rather than quietly count every response as wrong.
   */
  grade: ((answer: Answer, answerKey: K) => 0 | 1) | null;

  /**
   * The bars for the reveal and the presenter screen — or `null` where there
   * is nothing to distribute. Prose has no distribution, so anything that
   * tallies must branch on null rather than treat it as an empty result.
   */
  tally: ((answers: Answer[], content: C, answerKey: K) => TallyGroup[]) | null;
};

/** Which content, stored-content and answer-key types belong to which template. */
type Shapes = {
  which_principle: {
    content: WhichPrincipleContent;
    stored: WhichPrincipleContentStored;
    key: WhichPrincipleKey;
  };
  rank_variants: {
    content: RankVariantsContent;
    stored: RankVariantsContentStored;
    key: RankVariantsKey;
  };
  write_feedback: {
    content: WriteFeedbackContent;
    stored: WriteFeedbackContentStored;
    key: WriteFeedbackKey;
  };
};

export type Registry = {
  [K in TemplateKey]: QuestionTemplate<
    Shapes[K]["content"],
    Shapes[K]["key"],
    Shapes[K]["stored"]
  >;
};

const pickOne = (answer: Answer, key: string): 0 | 1 =>
  answer.option !== undefined && answer.option === key ? 1 : 0;

/**
 * The variant's identity letter — its position in the authored options array,
 * the same derivation the T2 components use, so a tally row and a card on
 * screen say the same letter.
 */
const letterAt = (index: number) => String.fromCharCode(65 + index);

/** "Ranked 1st", "Ranked 2nd" … */
const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
};

export const registry: Registry = {
  which_principle: {
    key: "which_principle",
    label: "Principles, side by side",
    blurb:
      "Two rubric codes in play, one excerpt — decide which one it should be judged under.",
    Review: WhichPrincipleReview,
    Reveal: WhichPrincipleReveal,
    Author: WhichPrincipleAuthor,
    empty: emptyWhichPrinciple,
    parse: {
      content: whichPrincipleContentStored,
      answerKey: whichPrincipleAnswerKey,
    },
    principleCodes: (content) => content.inPlay.map((p) => p.code),
    grade: (answer, answerKey) => pickOne(answer, answerKey.key),
    // One group, one row per option. There are only two options and exactly
    // one is right, so a wrong pick genuinely is wrong — hence "bad".
    tally: (answers, content, answerKey) => [
      {
        rows: content.options.map((opt): TallyRow => {
          const principle = content.inPlay.find(
            (p) => p.code === opt.principleCode,
          );
          return {
            label: principle
              ? `${opt.principleCode} — ${principle.name}`
              : opt.principleCode,
            votes: answers.filter((a) => a.option === opt.id).length,
            tone: opt.id === answerKey.key ? "ok" : "bad",
          };
        }),
      },
    ],
  },

  rank_variants: {
    key: "rank_variants",
    label: "Rank the completions",
    blurb:
      "Four replies promising the same change — order them, best communication first.",
    Review: RankVariantsReview,
    Reveal: RankVariantsReveal,
    Author: RankVariantsAuthor,
    empty: emptyRankVariants,
    parse: {
      content: rankVariantsContentStored,
      answerKey: rankVariantsAnswerKey,
    },
    // Ranking never names a code — the variants differ in delivery, not in
    // which principle they break. So this template links to no principles.
    principleCodes: () => [],
    // Exact match. At four variants that's 1-in-24 by chance; that is the
    // honest bar for calibration, but don't present it as a score.
    grade: (answer, answerKey) =>
      answer.order?.length === answerKey.keyOrder.length &&
      answer.order.every((id, i) => id === answerKey.keyOrder[i])
        ? 1
        : 0,
    /**
     * One group per POSITION — "who did the room put first", then second, and
     * so on — never one overall exact-match percentage. Rows stay in authored
     * order (A B C D) in every group so the bars line up down the screen.
     *
     * Only the key's letter is toned `ok`. The other three are left neutral
     * rather than `bad`: at a given position they are a distribution, not
     * three wrong answers, and painting three of four rows red at every
     * position is exactly the "everyone failed" reading the README warns
     * against.
     */
    tally: (answers, content, answerKey) =>
      content.options.map((_, position) => ({
        title: `Ranked ${ordinal(position + 1)}`,
        rows: content.options.map(
          (opt, index): TallyRow => ({
            label: letterAt(index),
            votes: answers.filter((a) => a.order?.[position] === opt.id).length,
            tone: opt.id === answerKey.keyOrder[position] ? "ok" : undefined,
          }),
        ),
      })),
  },

  write_feedback: {
    key: "write_feedback",
    label: "Reviewer feedback",
    blurb:
      "A fellow's rationale — decide whether it holds and write your own feedback.",
    Review: WriteFeedbackReview,
    Reveal: WriteFeedbackReveal,
    Author: WriteFeedbackAuthor,
    empty: emptyWriteFeedback,
    parse: {
      content: writeFeedbackContentStored,
      answerKey: writeFeedbackAnswerKey,
    },
    // The rationale names codes in prose, not as structured data. If these
    // questions should link to principles, that needs an explicit field —
    // there's nothing to derive from (D9: left unlinked).
    principleCodes: () => [],
    // Prose answer: nothing to grade against.
    grade: null,
    // …and nothing to distribute either.
    tally: null,
  },
};

export const templateKeys = Object.keys(registry) as TemplateKey[];
