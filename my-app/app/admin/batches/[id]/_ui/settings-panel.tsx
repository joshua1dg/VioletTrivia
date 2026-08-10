"use client";

// "use client" because every control here is bound to a handler prop. It is
// NOT the state owner any more — composer.tsx is (same as the library and
// queue panels). It also owns no pending state and calls no Server Action:
// there is exactly one save on this screen, and it lives in the composer's
// footer bar.

import type { BatchStatus, BatchWithCounts } from "@/lib/services/batches";

const STATUSES: BatchStatus[] = ["draft", "active", "inactive"];

/**
 * The settings panel's fields in the shape the *inputs* want them — strings
 * for the two free-text/numeric fields and for `<input type="datetime-local">`,
 * which wants local time with no offset. The conversion in both directions
 * lives here rather than in the composer so that "how a batch column is
 * spelled in a form control" stays next to the control that spells it.
 */
export type SettingsDraft = {
  name: string;
  audience: string;
  /** `YYYY-MM-DDTHH:mm`, local, or "" for never. */
  expiresAt: string;
  sampleSize: string;
  status: BatchStatus;
  isActiveAsync: boolean;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Server row → editable draft. The composer seeds its state with this. */
export function settingsDraftFromBatch(batch: BatchWithCounts): SettingsDraft {
  return {
    name: batch.name,
    audience: batch.audience ?? "",
    expiresAt: toLocalInputValue(batch.expiresAt),
    sampleSize: batch.asyncSampleSize?.toString() ?? "",
    status: batch.status,
    isActiveAsync: batch.isActiveAsync,
  };
}

/** Editable draft → the `settings` half of the `saveBatch` payload. */
export function settingsPatchFromDraft(draft: SettingsDraft) {
  return {
    name: draft.name,
    audience: draft.audience.trim() === "" ? null : draft.audience.trim(),
    // `<input type="datetime-local">` only ever yields "" or a well-formed
    // local timestamp, so this conversion can't produce an Invalid Date.
    expiresAt:
      draft.expiresAt === "" ? null : new Date(draft.expiresAt).toISOString(),
    // A non-numeric typo becomes NaN and the action's zod parse rejects it as
    // a returned error — the same path it took when this panel saved itself.
    asyncSampleSize:
      draft.sampleSize.trim() === "" ? null : Number(draft.sampleSize),
    status: draft.status,
    isActiveAsync: draft.isActiveAsync,
  };
}

/** True when two drafts describe the same batch — the composer's dirty check. */
export function settingsEqual(a: SettingsDraft, b: SettingsDraft): boolean {
  return (
    a.name === b.name &&
    a.audience === b.audience &&
    a.expiresAt === b.expiresAt &&
    a.sampleSize === b.sampleSize &&
    a.status === b.status &&
    a.isActiveAsync === b.isActiveAsync
  );
}

/**
 * The left column: everything about the batch that isn't its question list.
 *
 * Status and the active-async flag used to write immediately, one Server
 * Action per click, while the four text fields waited for a "Save settings"
 * button — two save idioms inside one panel. They are all plain edits to one
 * batch now, and they all commit through the composer's single footer save.
 */
export function SettingsPanel({
  draft,
  onChange,
}: {
  draft: SettingsDraft;
  onChange: (patch: Partial<SettingsDraft>) => void;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-2 p-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">NAME</label>
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          AUDIENCE
        </label>
        <input
          value={draft.audience}
          onChange={(e) => onChange({ audience: e.target.value })}
          placeholder="reviewers, pod leads…"
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          EXPIRES
        </label>
        <input
          type="datetime-local"
          value={draft.expiresAt}
          onChange={(e) => onChange({ expiresAt: e.target.value })}
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
        <span className="text-[11.5px] text-muted-3">
          Blank never expires. Expiring makes the link read-only, not dead.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          ASYNC SAMPLE SIZE
        </label>
        <input
          inputMode="numeric"
          value={draft.sampleSize}
          onChange={(e) => onChange({ sampleSize: e.target.value })}
          placeholder="blank = everyone answers all"
          className="rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-ink-4 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line-2 pt-4">
        <label className="text-[11.5px] tracking-[0.04em] text-faint">
          STATUS
        </label>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ status: s })}
              aria-pressed={draft.status === s}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-[12.5px] capitalize transition-colors ${
                draft.status === s
                  ? "border-violet-line bg-violet-tint-2 text-violet-ink"
                  : "border-line text-muted hover:bg-surface"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {draft.status === "inactive" && (
          <span className="text-[11.5px] text-muted-3">
            Read-only, not off — anyone who already answered can still see it.
          </span>
        )}
      </div>

      <label className="flex flex-wrap items-center gap-2 border-t border-line-2 pt-4 text-[13px] text-ink-4">
        <input
          type="checkbox"
          checked={draft.isActiveAsync}
          onChange={(e) => onChange({ isActiveAsync: e.target.checked })}
        />
        Active async pool
        <span className="text-[11.5px] text-muted-3">
          Only one batch may hold this at a time — activating this one
          deactivates whichever batch has it now, on save.
        </span>
      </label>
    </div>
  );
}
