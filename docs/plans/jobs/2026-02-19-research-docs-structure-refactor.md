---
title: "Research docs structure refactor"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: codex
---

## Goal

Move all `research*` documents into `docs/researches/` and update repository references to match the new structure.

## Changes Made

- Moved all files matching `docs/research-*.md` to `docs/researches/`.
- Updated `AGENTS.md` research document location guidance to `docs/researches/research-YYYY-MM-DD-<short-title>.md`.
- Updated research links and path references in plan/job/research docs from:
  - `docs/research-...` to `docs/researches/research-...`
  - `../research-...` to `../researches/research-...`
- Updated remaining plain-text reference `docs/research` to `docs/researches` in:
  - `docs/plans/plan-2026-01-14-latin-ambiguous-locale.md`

## Verification

- Confirmed no remaining `docs/research-...` or `../research-...` references in `README.md`, `docs/`, or `AGENTS.md`.
- Confirmed `docs/researches/` contains all migrated research files.
- Confirmed `README.md` has no research-path references requiring updates.
- Final pass: normalized `## Related Research` link style to backticked repo-root paths in:
  - `docs/plans/plan-2026-01-15-custom-yaml-frontmatter.md`
  - `docs/plans/plan-2026-01-15-simple-toml-parser.md`
