---
title: "Stable release notes script local verification"
created-date: 2026-02-19
modified-date: 2026-02-19
status: completed
agent: codex
---

## Goal

Make stable release-note generation locally reproducible before CI by extracting the stable note logic into a reusable shell script and documenting how to run it.

## Changes Made

- Added `scripts/generate-stable-release-notes.sh`.
  - Accepts `--mode`, `--range`, `--current-tag`, optional `--previous-tag`, optional `--repository`, and optional `--fallback-login`.
  - Generates the same stable sections used by CI:
    - grouped "What's Changed"
    - `Contributors` (unique non-bot authors)
    - `Changelog` with range/compare metadata and commit list
  - Excludes merge commits via `git log --no-merges`.
  - Supports `--mode pr` for PR-oriented rendering with per-line contributor attribution (`by @user`):
    - Uses GitHub PR metadata when available.
    - Falls back to plain local author text when GitHub login resolution is unavailable.
  - Uses GitHub REST API (`curl` + `jq`) for login/PR resolution, removing dependency on local `gh` CLI auth state.
- Added `scripts/local-release-verification.sh` as a quick local wrapper.
  - Auto-resolves current/previous stable tags and range by default.
  - Supports overrides via flags: `--mode`, `--current-tag`, `--previous-tag`, `--range`, `--repository`, `--fallback-login`, `--output`, `--show-inputs`.
  - Includes built-in `--help` usage text.
- Updated `.github/workflows/release.yml` stable notes step to call `scripts/generate-stable-release-notes.sh` instead of embedding the logic inline.
  - Added `GH_TOKEN` env so GitHub login resolution works in CI for contributor attribution.
  - Set stable release default mode to `pr` for contributor-attributed release lines in CI output.
- Added `docs/release-notes-local-verification.md` with local verification commands.
- Added a local mode-diff workflow in docs to compare commit vs PR render outputs.
- Added a forced fallback login option for local preview when API login resolution is unavailable.
- Updated changelog format:
  - Replaced list-style range metadata with `Full Changelog: <range-or-compare-link>`.
  - Removed standalone contributors section; contributor attribution is now shown only in `### Changelog` lines.

## Verification

- Ran `scripts/generate-stable-release-notes.sh --help` successfully.
- Ran `scripts/generate-stable-release-notes.sh --mode pr ...` successfully (with local fallback behavior when PR metadata is unavailable).
- Confirmed contributor attribution in commit mode is rendered as `@login` when GitHub login resolution is available.
- Avoided incorrect mentions by preventing synthetic `@` generation from unresolved local git author names.
- Added best-effort email-based user search fallback for commit login resolution when direct author/committer login is unavailable.
- Ran `scripts/local-release-verification.sh --help` successfully.
- Ran `scripts/local-release-verification.sh --show-inputs` successfully and confirmed resolved tag/range values.
- Ran `scripts/local-release-verification.sh --mode commit` and `--mode pr` successfully for output comparison.
- Ran fallback path with `--fallback-login @your-account-name` and confirmed contributor output is forced to the requested login.
- Ran script against stable range `v0.1.2..v0.1.3` and confirmed expected markdown output structure.
