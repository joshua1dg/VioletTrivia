-- The middle tier's real-world name is DOL (2026-08-13) — "project lead"
-- was invented here and never matched the org's vocabulary. Same in-place
-- rename as host → pod_lead before it: existing rows keep working, the
-- regenerated types force every stale code reference to fail loudly.
-- Permissions are untouched; only the word changes.

alter type staff_role rename value 'project_lead' to 'dol';
