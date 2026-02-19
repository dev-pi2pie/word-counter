---
title: "Release notes CI/CD prerelease stable split"
created-date: 2026-02-19
status: completed
agent: codex
---

## Goal

Keep pre-release notes (`alpha`, `beta`, `rc`, `canary`) on GitHub default "What's changed" format while using a custom categorized `git-cliff` format for stable releases.

## Changes Made

- Updated `/Users/nakolus/Projects/github-work/dev-pi2pie/word-counter/.github/workflows/release.yml`:
  - Added conditional prerelease notes step using `config: github`.
  - Added conditional stable notes step using `config: .cliff.toml`.
  - Added a selector step that outputs one notes body for release creation.
  - Switched `jobs.notes.outputs.release_notes` to use selector output.
- Added `/Users/nakolus/Projects/github-work/dev-pi2pie/word-counter/.cliff.toml` for stable categorized notes with Conventional Commit grouping.

## Verification

- Kept existing release range resolution logic unchanged.
- Stable releases still resolve against the previous stable tag and include all commits in the range (including commits delivered via prereleases between stable tags).
