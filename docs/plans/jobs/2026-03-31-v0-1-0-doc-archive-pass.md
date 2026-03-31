---
title: "v0.1.0 doc archive pass"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: Codex
---

## Goal

Run the first conservative archive pass for historical documentation using the `v0.1.0` release boundary as a review cutoff, not as an automatic archive rule.

## Scope

- Review top-level plan docs in `docs/plans/`
- Review top-level research docs in `docs/researches/`
- Move only pre-`v0.1.0` historical docs that no longer need to remain primary working references
- Keep job records in `docs/plans/jobs/`
- Repair repository-relative links affected by moved docs

## Archive Rule Used

- Use the local `v0.1.0` tag commit date (`2026-02-17`) as the review boundary
- Include only top-level plan and research docs created before `2026-02-17`
- Exclude same-day and later docs from this first pass
- Do not change `modified-date` when only moving docs or rewriting links for archive paths

## Verification Plan

- Confirm archive directories exist and moved files land in the expected locations
- Search for stale references to moved doc paths
- Confirm no job records were moved

## Completed Work

- Created `docs/plans/archive/` and `docs/researches/archive/`
- Moved 19 top-level plan docs created before `2026-02-17` into `docs/plans/archive/`
- Moved 10 top-level research docs created before `2026-02-17` into `docs/researches/archive/`
- Rewrote repository-relative links affected by those moves across active plans, active research docs, archived docs, and job records
- Left `docs/plans/jobs/` in place without introducing a job archive path

## Verification

- Confirmed the archive directories contain the moved docs
- Confirmed no stale repository-relative references remain for the moved pre-`v0.1.0` docs
- Confirmed job records remain under `docs/plans/jobs/`

## Notes

- This first pass intentionally excluded docs created on `2026-02-17` and later, even if they are completed
- `AGENTS.md` already had local user changes when this pass started and was left untouched
