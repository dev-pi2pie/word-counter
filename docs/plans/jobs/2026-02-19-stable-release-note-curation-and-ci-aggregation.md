---
title: "Stable release note curation and CI aggregation"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: codex
---

## Goal

Provide a concise stable release note body that aggregates canary-delivered commits in one curated changelog, and update CI so future stable releases do not split into multiple canary-tag sections.

## Changes Made

- Created and later removed `docs/release-notes/stable-release-note-curated-2026-02-19.md` (temporary paste-ready manual replacement for the transition period).
- Updated `.github/workflows/release.yml`:
  - Replaced stable `git-cliff` generation with a stable-only shell aggregator over the precomputed release range.
  - Aggregated commits into one `## What's Changed` section with grouped bullets and exactly one `### Full Changelog` section.
  - Kept pre-release note generation behavior unchanged.
  - Fixed a workflow YAML parsing failure by replacing a multiline shell string assignment with `printf -v` (line-safe inside `run: |`).
  - Renamed prerelease note step/output identifiers to explicit `prerelease_*` names for clarity.
  - Added inline note in stable step describing why stable does not use git-cliff templating.
- Removed `.cliff.toml` to avoid ambiguity about active stable release-note generation.

## Why This Fix Works

- Root cause: stable notes rendered through `git-cliff` in a range containing interim canary tags produced canary-style repeated changelog chunks.
- Resolution: stable notes now use one explicit `git log --no-merges --reverse` pass over the computed stable range, then classify/group once.
- Outcome: stable release notes remain concise and deterministic with one curated changelog body, while prerelease notes still use the existing GitHub-default path.

## Verification

- Confirmed the stable generator reads from `${{ steps.range.outputs.range }}` and uses `git log --no-merges --reverse`, so stable output is range-based and no longer split by interim canary tags.
- Confirmed selector step now reads stable notes from `steps.stable_notes.outputs.content`.
- Confirmed `.cliff.toml` is no longer referenced by the active workflow.
