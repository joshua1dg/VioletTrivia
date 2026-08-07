import type { WhichPrincipleContent, WhichPrincipleKey } from "@/lib/templates/types";

/** The T1 example from the design doc, so the demo renders something real. */

export const whichPrinciplePrompt =
  "Which principle is this excerpt best judged under?";

export const whichPrincipleContent: WhichPrincipleContent = {
  inPlay: [
    {
      code: "S1",
      name: "Simple and scannable",
      descriptor:
        "One signal per sentence, so the reader can take it in at a glance.",
    },
    {
      code: "C1",
      name: "Effective communication",
      descriptor:
        "Acknowledge, state the change, say what it leaves behind — in that order.",
    },
  ],
  turns: [
    {
      role: "user",
      body: "the translation strings shouldn't be sitting in App.vue",
    },
    {
      role: "assistant",
      meta: "1 sentence · turn 3",
      body: "I'll move the actual translation strings out of App.vue and into JSON files under src/assets, then connect them through Vue I18n so future components can use the same locale state, keeping App.vue responsible only for selecting the current locale.",
    },
  ],
  options: [
    {
      id: "s1",
      principleCode: "S1",
      subtext:
        "The content is all there; it's the shape of the sentence that costs the reader.",
    },
    {
      id: "c1",
      principleCode: "C1",
      subtext: "The reader is left unsure what was agreed, changed, or left behind.",
    },
  ],
  footerHint:
    "Both principles could be argued — pick the one the excerpt actually fails.",
};

export const whichPrincipleKey: WhichPrincipleKey = {
  key: "S1",
  perOption: {
    S1: [
      "Nothing is missing and nothing is wrong. The action, both destinations, the rationale, and what App.vue is left doing all arrive — inside one sentence.",
      "That is an S1 failure: the reader has to unpack five signals before any one of them lands.",
    ],
    C1: [
      "C1 is for when the message doesn't land at all — the user can't tell what was agreed, what changed, or what happens next.",
      "Here they can tell. It just costs them a re-read.",
    ],
  },
  distinguish: {
    title: "How to tell them apart",
    body: "Ask what the reader ends up without. Missing a signal entirely is C1. Having every signal but in an order or shape that's hard to take in is S1.",
  },
  summary: "Same content either way — S1 is about the shape it arrives in.",
};
