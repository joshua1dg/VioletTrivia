/**
 * The library list shows an excerpt, not a prompt — "the translation strings
 * shouldn't be sitting in App.vue" is what makes one row distinguishable
 * from the next. Every template's content carries `turns`, and the first one
 * is the request being judged, so that is the line.
 *
 * Pure, and defensive about shape: this runs over content that has already
 * been zod-parsed, but the three templates do not share a static type here,
 * so it reads structurally rather than by narrowing.
 */

const MAX = 96;

export function excerptFrom(content: unknown): string {
  const turns = (content as { turns?: unknown })?.turns;
  if (!Array.isArray(turns) || turns.length === 0) return "";

  const first = turns[0] as { body?: unknown };
  const body = typeof first?.body === "string" ? first.body : "";

  return truncate(body.replace(/\s+/g, " ").trim(), MAX);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
