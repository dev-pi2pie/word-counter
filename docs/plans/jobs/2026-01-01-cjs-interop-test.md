---
title: "Add CJS interop test and build notice"
created-date: 2026-01-01
status: completed
agent: Codex
---

## Summary

- Add a Bun test that verifies the CJS wrapper returns the default function
  and exposes named exports.
- Document that `bun run build` must run before tests because the CJS test
  loads `dist/cjs/index.cjs`.

## Rationale

The CJS wrapper is emitted only during build, so tests need a build artifact
available in `dist/` to validate interop behavior.

## Changes

- Added `test/cjs-interop.test.ts` to verify CJS wrapper behavior.
- Documented build-before-test note in `README.md`.
