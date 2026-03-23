---
title: "Fix detector CJS export parity"
created-date: 2026-03-24
status: completed
agent: codex
---

Fix the published CommonJS detector wrapper so it exports the same runtime-unavailable message constant as the ESM detector entry and the detector subpath type surface.

- Added `WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE` to `src/detector/index.cjs.ts`.
- Extended built-surface CJS interop coverage to assert the detector wrapper exposes the message constant.

Verification:

- `bun run build`
- `bun test test/cjs-interop.test.ts`
- `bun run verify:package-contents`
