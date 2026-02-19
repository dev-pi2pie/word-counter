---
title: "Stable release notes contributors and changelog range"
created-date: 2026-02-19
status: completed
agent: codex
---

## Goal

Improve stable release-note readability by adding a curated contributors section, renaming `Full Changelog` to `Changelog`, and explicitly showing the release range.

## Changes Made

- Updated `.github/workflows/release.yml` stable notes step:
  - Added `PREVIOUS_TAG`, `CURRENT_TAG`, and `REPOSITORY` env values for range metadata.
  - Added `### Contributors` section based on unique non-bot commit authors in the stable range.
  - Renamed section heading from `### Full Changelog` to `### Changelog`.
  - Added range metadata lines under `### Changelog`:
    - `Range: <previous_tag>..<current_tag>` when previous tag exists.
    - `Compare: https://github.com/<owner>/<repo>/compare/<previous_tag>...<current_tag>` when previous tag exists.
    - Fallback `Range: <current_tag>` when there is no previous tag.

## Verification

- Stable note generation still uses `git log --no-merges`, so merge commits remain excluded.
- New `Contributors` and `Changelog` blocks are generated only in the stable path; prerelease path remains unchanged.
