---
title: "Fix debug report stream error handling"
created-date: 2026-02-16
status: completed
agent: codex
---

## Summary

Addressed a crash path in debug report logging when `--debug-report` points to an invalid or unwritable output path.

## What Changed

- Added eager file-open validation in `createFileSink` using `openSync`/`closeSync` so invalid report paths fail during debug channel initialization.
- Added immediate stream `error` listener registration to prevent unhandled stream errors from terminating the process.
- Hardened sink behavior to no-op writes/close when the stream has already errored or ended.
- Added regression coverage: `CLI debug diagnostics > fails fast when debug report path is not writable`.

## Why

Without early validation and immediate stream error handling, write stream failures could surface as unhandled errors and crash the CLI.

## Verification

- `bun test test/command.test.ts`
