/**
 * Zod for API payloads — the schemas that sit at the Server Action boundary
 * (PLAN §5.7 / §5.9). Template SHAPES live in each template's own
 * `schema.ts` under `lib/templates`; this folder is about the envelopes
 * those shapes travel in.
 *
 * No `server-only` anywhere in here — client forms import these too.
 */

export * from "./participants";
export * from "./responses";
export * from "./questions";
export * from "./topics";
