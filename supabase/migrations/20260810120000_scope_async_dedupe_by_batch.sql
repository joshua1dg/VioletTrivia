-- Re-scope the async dedupe by batch (decision 2026-08-10).
--
-- The init migration deduped async answers ORG-WIDE ("if a question appears
-- in two async batches, a participant still answers it once"). In practice
-- that was wrong twice over: a question shared between two batches arrived
-- in the second one pre-answered (the participant never got to take it),
-- and the second batch's report silently under-counted, because every
-- answer row is credited to whichever batch the participant hit first.
-- Re-asking is also wanted, not feared — seeing the same question again in
-- a later set reinforces the learning.
--
-- The index itself stays: one answer per participant per question PER
-- CONTEXT (one async batch, or one live session). That much is race
-- protection against double-taps and refreshes, which app code cannot win.
drop index responses_dedupe;

create unique index responses_dedupe on responses (
  question_id,
  participant_id,
  coalesce(batch_id,        '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(live_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
