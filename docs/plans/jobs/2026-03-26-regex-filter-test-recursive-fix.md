---
title: "regex filter test recursive fix"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Fix a failing CLI test whose setup expected nested directory traversal without enabling recursive path expansion.

## What Changed

- Updated `test/command-filters.test.ts` so the nested directory regex filter scenario passes `--recursive`.

## Why

- The test fixture places the matched file under `docs/keep.md`, which is not reachable from a top-level directory scan unless recursive traversal is enabled.
- This aligns the test with the current CLI path-resolution contract instead of changing runtime behavior for an unrelated CI patch.

## Validation

- `bun test test/command-filters.test.ts`
- `bun test`
