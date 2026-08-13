-- Wave 2: propose-to-master (PODS.md), settled 2026-08-12.
--
-- A proposal IS a question — same table, same form, same editor. What
-- distinguishes it is a REVIEW dimension, orthogonal to the existing
-- lifecycle enum: `status` (draft/live/archived) answers "can this be
-- answered right now?", `review_status` answers "has the roundtable
-- vetted this?". Keeping them separate lets an approved question sit in
-- draft while a curator polishes it, and gives every consumer-facing
-- list one uniform predicate (review_status = 'approved') instead of a
-- memorized set of safe lifecycle states.
--
-- Flow: any staff member authors a question; the service forces
-- non-curators' work in as 'proposed'. Project leads and admins see the
-- pending pile under Proposals, then approve (curatable — appears in
-- the library and the batch composer) or deny with a note. A denied
-- question is editable by its submitter and resubmittable — the same
-- row flips back to 'proposed', so the roundtable's note travels with
-- the revision. No notifications: the Proposals tab is the inbox.

create type review_status as enum ('proposed', 'approved', 'denied');

alter table questions
  -- Default 'approved': every existing row and every curator-created
  -- question keeps working untouched. Only the service ever writes
  -- 'proposed', and only for authors who cannot curate the master set.
  add column review_status review_status not null default 'approved',
  -- The roundtable's "why" — surfaced to the submitter on denial, since
  -- there are no notifications. Cleared on resubmit? No: kept until the
  -- next verdict overwrites it, so the revision happens beside the note.
  add column review_note   text,
  add column reviewed_by   uuid references staff(user_id) on delete set null,
  add column reviewed_at   timestamptz;

-- The Proposals tab reads two slices constantly: "mine" (by author) and
-- "the pending pile" (by review_status). author_id already has no index
-- — questions are few, but the predicate pair is worth making cheap.
create index questions_review_status_idx on questions(review_status);
