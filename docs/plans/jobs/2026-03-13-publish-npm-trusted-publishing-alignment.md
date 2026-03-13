---
title: "publish npm trusted publishing alignment"
created-date: 2026-03-13
modified-date: 2026-03-13
status: completed
agent: Codex
---

## Goal

Align the npm publish workflow with current npm trusted publishing behavior and remove release-path dead logic.

## What Changed

- Updated the publish workflow to use a Node.js version that satisfies current npm trusted publishing requirements.
- Pinned npm to a trusted-publishing-compatible version instead of floating to `latest`.
- Removed redundant prerelease label output and dead `npm dist-tag add` logic that cannot run under tokenless OIDC publishing.
- Removed explicit `--provenance` from `npm publish` because trusted publishing already generates provenance.
- Added a guard to ensure the publishing tag matches `package.json` version before release.
- Excluded `alpha` and `beta` tags at the `push` trigger level with negative `tags` patterns and added an explicit runtime guard so they still fail closed for manual dispatch.

## Validation

- Parsed `.github/workflows/publish-npm-packages.yml` successfully with Ruby YAML (`YAML OK`).
- Reviewed the workflow diff to confirm:
  - `NODE_AUTH_TOKEN` remains explicitly empty for tokenless OIDC publishing.
  - prerelease publishing now uses only the supported `next` tag path.
  - explicit `--provenance` flags were removed.
  - publish now fails fast when tag and `package.json` version do not match.
  - `alpha` and `beta` tags are blocked both by trigger filtering and by an in-workflow guard.
