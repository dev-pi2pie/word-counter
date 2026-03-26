---
title: "node runtime and ci baseline upgrade"
created-date: 2026-03-26
modified-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Raise the supported Node.js floor to satisfy current `tsdown` requirements and align GitHub Actions workflows with the Node 24 JavaScript-action migration.

## What Changed

- Updated the project runtime contract to Node.js `>=22.18.0` in `package.json`, `README.md`, and the doctor diagnostics surface.
- Updated `tsdown.config.ts` targets from `node20` to `node22` so emitted bundles match the new runtime floor.
- Updated `.github/workflows/ci.yml` and `.github/workflows/release.yml` to use Node.js `22.18.0` for explicit `setup-node` steps.
- Opted GitHub Actions workflows into the Node 24 JavaScript-action runtime with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`.
- Upgraded release artifact actions to `actions/upload-artifact@v6` and `actions/download-artifact@v7` to use Node 24-capable releases.
- Tightened doctor runtime validation so versions below `22.18.0` warn correctly instead of only checking the major version.

## Validation

- `bun test test/command-doctor.test.ts`
- `bun run build`
- `bun run type-check`
- `bun run verify:package-contents`
