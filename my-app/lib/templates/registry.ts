import type { ComponentType } from "react";
import type {
  Answer,
  AuthorProps,
  BestFeedbackContent,
  BestFeedbackKey,
  RankVariantsContent,
  RankVariantsKey,
  RevealProps,
  ReviewProps,
  TemplateKey,
  WhichPrincipleContent,
  WhichPrincipleKey,
} from "./types";

import { WhichPrincipleReveal, WhichPrincipleReview } from "./which-principle";
import {
  WhichPrincipleAuthor,
  emptyWhichPrinciple,
} from "./which-principle/author";
import { RankVariantsReveal, RankVariantsReview } from "./rank-variants";
import { RankVariantsAuthor, emptyRankVariants } from "./rank-variants/author";
import { BestFeedbackReveal, BestFeedbackReview } from "./best-feedback";
import { BestFeedbackAuthor, emptyBestFeedback } from "./best-feedback/author";

/**
 * Everything that varies by template, in one object per template.
 *
 * The payoff is that nothing else in the app branches on `template`. The
 * reviewer page looks up `Review`, the admin editor looks up `Author`, the
 * results page will look up `tally`. Adding a fourth template is a folder and
 * one entry here — and because the enum drives `TemplateKey`, the project
 * stops compiling until that entry exists.
 */
export type QuestionTemplate<C, K> = {
  key: TemplateKey;
  label: string;
  blurb: string;

  Review: ComponentType<ReviewProps<C>>;
  Reveal: ComponentType<RevealProps<C, K>>;
  Author: ComponentType<AuthorProps<C, K>>;

  /** A blank question of this shape, for the New question screen. */
  empty: () => { content: C; answerKey: K };

  /**
   * Which rubric codes this question exercises — DERIVED from the content,
   * never picked separately. The codes are already named inside the question
   * (the two in play, the calls a fellow made), so a second picker would be a
   * second source of truth that can disagree with the first.
   *
   * This is what writes question_principles on save.
   */
  principleCodes: (content: C) => string[];

  /** 0 or 1. Computed at read time, never stored. */
  grade: (answer: Answer, answerKey: K) => 0 | 1;
};

/** Which content and answer-key types belong to which template. */
type Shapes = {
  which_principle: [WhichPrincipleContent, WhichPrincipleKey];
  rank_variants: [RankVariantsContent, RankVariantsKey];
  best_feedback: [BestFeedbackContent, BestFeedbackKey];
};

export type Registry = {
  [K in TemplateKey]: QuestionTemplate<Shapes[K][0], Shapes[K][1]>;
};

const pickOne = (answer: Answer, key: string): 0 | 1 =>
  answer.option !== undefined && answer.option === key ? 1 : 0;

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
    principleCodes: (content) => content.inPlay.map((p) => p.code),
    grade: (answer, answerKey) => pickOne(answer, answerKey.key),
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
  },

  best_feedback: {
    key: "best_feedback",
    label: "Practice writing feedback",
    blurb:
      "A fellow's rationale and its rubric calls — pick the response that helps most.",
    Review: BestFeedbackReview,
    Reveal: BestFeedbackReveal,
    Author: BestFeedbackAuthor,
    empty: emptyBestFeedback,
    // The calls the fellow made are the codes in play, right or wrong.
    principleCodes: (content) => content.subject.calls.map((c) => c.code),
    grade: (answer, answerKey) => pickOne(answer, answerKey.key),
  },
};

export const templateKeys = Object.keys(registry) as TemplateKey[];
