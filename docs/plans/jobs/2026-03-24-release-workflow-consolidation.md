---
title: "release workflow consolidation"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Consolidate release publishing into one workflow so the Rust/WASM build runs once per release and both registries reuse the same prepared package artifact.

## What Changed

- Updated `.github/workflows/release.yml` to become the single release orchestrator.
- Kept the existing `notes` job for tag resolution, branch validation, and release-notes generation.
- Added a `prepare` job that:
  - checks out the release tag
  - sets up Bun, Node, Rust, and `wasm-pack`
  - installs dependencies
  - runs `bun run build`
  - runs `bun run verify:package-contents`
  - uploads a release artifact containing:
    - `dist/`
    - `package.json`
    - `README.md`
    - `LICENSE*`
- Added `publish_npm` and `publish_github_packages` jobs that download the prepared artifact instead of rebuilding.
- Kept npm trusted publishing behavior inside the new `publish_npm` job.
- Kept GitHub Packages package-name rewriting and prerelease dist-tag behavior inside the new `publish_github_packages` job.
- Removed the duplicated tag-triggered workflows:
  - `.github/workflows/publish-npm-packages.yml`
  - `.github/workflows/publish-github-packages.yml`
- Updated the release flow so the final GitHub Release record is created only after both publish jobs succeed.

## Decisions

- Keep `.github/workflows/ci.yml` as a separate validation workflow.
  - CI is still responsible for pull-request and integration-branch health.
  - CI is not used as the source of release artifacts.
- Prefer same-workflow artifact reuse over cross-workflow artifact lookup.
  - This avoids tag-to-run matching, rerun ambiguity, and artifact-retention coupling.
- Keep tag and branch validation in the `notes` job for now.
  - The resolved tag context is already needed there for release-note generation.
- Keep the shared release artifact narrow.
  - Publish jobs need package metadata and built outputs, not dependency trees.

## Validation

- Parsed `.github/workflows/ci.yml` successfully with the repository `yaml` package.
- Parsed `.github/workflows/release.yml` successfully with the repository `yaml` package.

## Follow-up

- Real GitHub Actions validation is still needed for:
  - stable vs prerelease routing
  - manual `workflow_dispatch` with explicit `tag`
  - rerun behavior for failed publish jobs
  - confirmation that the uploaded artifact is sufficient for both registries in hosted runners

## Related Plans

- `docs/plans/plan-2026-03-24-release-workflow-consolidation.md`

## Related Research

- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
