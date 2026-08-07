import type { WriteFeedbackContent, WriteFeedbackKey } from "@/lib/templates/types";

/** The T3 example from the design. */

export const writeFeedbackPrompt = "Write feedback for this fellow";

export const writeFeedbackContent: WriteFeedbackContent = {
  turns: [
    {
      role: "user",
      body: '"the changelog badges look cramped, can you fix the spacing"',
    },
    {
      role: "assistant",
      body: [
        "Tightened the badge spacing in the summary section. Here's what changed:",
        "- updated header: Receipts & Payments — subtitle, gradient card",
        "- added direction badges: Receipt IN / Payment OUT",
        "Spacing now reads cleanly at both widths.",
      ].join("\n"),
    },
  ],
  subject: {
    rationale:
      '"S2 — the nested bulleted list is an AI-ism. It reads machine-generated and clutters the answer. Misaligned."',
  },
};

export const writeFeedbackKey: WriteFeedbackKey = {
  verdict: "Rationale is weak",
  verdictTone: "weak",
  blocks: {
    working:
      "The rationale spots a real defect. The nested list does cost the reader effort, so the instinct is correct and there is a genuine problem on the page.",
    correcting:
      "The code is where it goes sideways. S2 covers the named tics like sycophantic openers, template headers, and emoji, so bullets sit outside it. The defect described is scan cost, which is S1. Naming the wrong code sends the whole claim off track even though the observation was right.",
    improve:
      'Keep the finding and move it to S1, then anchor it by naming the two-level nesting under "updated header" and "added direction badges" as the spot forcing the eye down and back. Same evidence, right code.',
  },
  exemplar:
    '"Thanks for the work on this one. The nested list is a real catch, and flagging that it costs the reader is the right call. One thing I noted in the rationale is that it names S2, but S2 covers the named tics like sycophantic openers and template headers, so bullets sit outside it. The right idea is there, but the wording points to a scan cost issue, which is S1. The rationale could swap to S1, or the wording could be changed to better align with the code the justification is pointing to."',
  toneNote:
    "Tone note: it points at the rationale, not the person. The catch is credited before the fix, so the correction reads as collaboration, not a takedown.",
};
