---
title: "release gh cli node24 compat"
created-date: 2026-03-27
status: completed
agent: Codex
---

## Goal

Remove the final release step's dependency on a JavaScript action that still warns about the Node.js 20 to Node.js 24 GitHub Actions runtime transition.

## What Changed

- Updated `.github/workflows/release.yml` so the `release` job uses the GitHub CLI instead of `softprops/action-gh-release@v2`.
- Kept the existing release inputs from the `notes` job:
  - release tag
  - prerelease flag
  - generated release notes
- Made the release step idempotent for reruns by:
  - editing the existing release when the tag already has one
  - creating a new release only when one does not yet exist

## Why

- The workflow already opts JavaScript actions into Node.js 24, but `softprops/action-gh-release@v2` still emits a deprecation warning because its published action runtime has not yet moved off Node.js 20.
- Using `gh release create` and `gh release edit` avoids that runtime coupling entirely while keeping the release behavior explicit and easy to rerun.
- The `release` job only needs `contents: write`, the resolved tag, and the generated notes, so a direct CLI step is sufficient.

## Validation

- Parsed `.github/workflows/release.yml` successfully as YAML after the change.
- Rechecked that the `release` job still depends on successful completion of `notes`, `publish_npm`, and `publish_github_packages` before creating or updating the GitHub release.

## Related Plans

- `docs/plans/plan-2026-03-24-release-workflow-consolidation.md`
