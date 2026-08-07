import type { RankVariantsContent, RankVariantsKey } from "@/lib/templates/types";

/** The T2 example from the design doc. */

export const rankVariantsPrompt =
  "Rank these replies — best communication at the top.";

export const rankVariantsContent: RankVariantsContent = {
  turns: [
    {
      role: "user",
      body: "the translation strings shouldn't be sitting in App.vue",
    },
  ],
  subhead: "All four promise the same change. Only the delivery differs.",
  shuffle: true,
  options: [
    {
      id: "c",
      body: "Agreed. Translation text should live outside App.vue. I'll move it into cs.json and en.json under src/assets/i18n, then load those files through Vite imports.",
      note: "Acknowledgement · understanding · one sentence carrying two actions and three paths.",
    },
    {
      id: "b",
      body: "Agreed. I'll move the message strings out of App.vue into JSON files under src/assets, then keep App.vue responsible only for selecting the active locale.",
      note: "Acknowledgement · one sentence: an action, two locations, and what App.vue is left doing.",
    },
    {
      id: "a",
      body: "Agreed. The translations should live outside App.vue. I'll move them into src/assets/i18n/cs.json and en.json, then connect them through Vue I18n so future components can use the same locale state.",
      note: "Acknowledgement · understanding · one sentence with two actions, two paths, and the rationale.",
    },
    {
      id: "d",
      body: "I'll move the actual translation strings out of App.vue and into JSON files under src/assets, then keep App.vue responsible only for selecting the current locale. This is a better structure before more translated text is added.",
      note: "No acknowledgement · a long chained opener · a justification tacked on the end.",
    },
  ],
  footerHint: "Every reviewer sees the same four, shuffled.",
};

export const rankVariantsKey: RankVariantsKey = {
  keyOrder: ["b", "c", "a", "d"],
  rationaleTitle: "Why the top one wins",
  rationale:
    "It acknowledges, then commits in a single clean sentence — an action, where it goes, and what App.vue is left doing. The lower-ranked replies say the same thing but stack a second action, a third path, or a justification on top, so the reader has to unpack it.",
};

/**
 * grade is exact match. With four variants that is 1-in-24 by chance, which
 * is the honest bar for a calibration exercise but will read as everyone
 * failing if it is ever presented as a score.
 */
export function gradeRankVariants(order: string[]): 0 | 1 {
  return order.length === rankVariantsKey.keyOrder.length &&
    order.every((id, i) => id === rankVariantsKey.keyOrder[i])
    ? 1
    : 0;
}
