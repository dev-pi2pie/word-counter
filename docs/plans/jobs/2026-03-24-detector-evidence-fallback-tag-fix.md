---
title: "detector evidence fallback tag fix"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Correct detector evidence output so fallback windows report the same post-fallback Latin locale that the final counted result uses when Latin hints relabel `und-Latn`.

## What Changed

- Updated `src/detector/wasm.ts` so fallback debug payloads derive their reported final locale from the same deferred Latin fallback pass used by the runtime result.
- Kept the runtime fallback return value unchanged for the detector pipeline while fixing only the emitted debug metadata.
- Added a CLI regression test in `test/command.test.ts` that verifies `--detector-evidence` reports `de` instead of `und-Latn` for a hinted short Latin fallback window.

## Why

- The previous detector evidence payload could report `und-Latn` even when deferred Latin fallback relabeled the final chunk to a hinted locale such as `de`.
- That made the new debugging surface disagree with the actual counted output for supported Latin-hint configurations.

## Verification

- `bun test test/command.test.ts`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-03-24-detector-evidence-debug-implementation.md`

## Related Jobs

- `docs/plans/jobs/2026-03-24-detector-evidence-phases-1-4-implementation.md`
