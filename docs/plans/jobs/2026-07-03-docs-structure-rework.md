---
title: "Docs structure rework"
created-date: 2026-07-03
status: completed
agent: Codex
---

## Goal

Rework the current documentation structure so guide, note, and schema/contract documents each have explicit directory entries while preserving the existing research, plan, and job-record lifecycle policy.

## Changes

- Revised `DOCUMENTATION_POLICY.md` to define `docs/guides/`, `docs/notes/`, and `docs/schemas/` as current reference surfaces.
- Kept archive scope limited to research docs and top-level plan docs.
- Moved current usage guides into `docs/guides/`.
- Moved current note-style docs into `docs/notes/`.
- Kept schema/contract docs in `docs/schemas/`.
- Updated repository-relative references to the moved guide and note docs.

## Validation

- Confirmed no references remain to the old first-layer guide or note paths.
- Confirmed the moved guide and note docs exist under the new directories.
