-- ============================================================================
-- Migration 0004 — content moderation action types  (Step 8, Part 2)
-- ----------------------------------------------------------------------------
-- Adds 'remove' and 'restore' to mod_action so a moderator can hide a piece of
-- content and later un-hide it. A reversal is always a NEW 'restore' row, never
-- an edit — the log stays append-only.
--
-- IMPORTANT: apply this BEFORE migration 0005. PostgreSQL can't use a freshly
-- added enum value in the same transaction that adds it, and 0005 references
-- both new values (in a CHECK constraint and a view). Run 0004, then 0005.
-- Safe to re-run.
-- ============================================================================
alter type mod_action add value if not exists 'remove';
alter type mod_action add value if not exists 'restore';
