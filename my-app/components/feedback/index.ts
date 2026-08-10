// Public surface of the shared feedback layer (PLAN §5.8/§9 B3). Wave 3
// imports from here, never from an individual file — read-only for all of
// Wave 3 (PLAN §9's "Shared-code rule").

export { ErrorNote, toErrorLike, type ErrorLike, type ErrorNoteTone } from "./error-note";
export { SubmitButton } from "./submit-button";
export { ConfirmDelete, type ConfirmDeleteOutcome } from "./confirm-delete";
export { EmptyState } from "./empty-state";
export { SkippedRowsBanner, type SkippedRow } from "./skipped-rows-banner";
