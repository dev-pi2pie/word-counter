---
title: "typescript peer range alignment"
created-date: 2026-03-27
status: completed
agent: Codex
---

## Goal

Align the published TypeScript peer dependency range with the TypeScript 6 toolchain upgrade.

## What Changed

- Updated `package.json` to widen `peerDependencies.typescript` from `^5` to `^5 || ^6`.
- Updated the workspace metadata in `bun.lock` to keep the lockfile consistent with the published package manifest.

## Why

- The package is built and type-checked with TypeScript 6 in the current branch.
- Keeping the peer range at `^5` would produce incorrect peer dependency warnings for TypeScript 6 consumers and stricter package managers.

## Validation

- Rechecked the package manifest and lockfile to confirm both now advertise the same TypeScript peer range.
