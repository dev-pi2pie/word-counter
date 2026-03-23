---
title: "Review findings package and test fixes"
created-date: 2026-03-24
modified-date: 2026-03-24
status: completed
agent: codex
---

Address follow-up review findings in package metadata and test setup.

- Align published type entrypoints with the declaration filenames emitted by tsdown.
- Keep the default `bun test` workflow independent of prebuilt `dist/` artifacts.
- Preserve wasm coverage without making clean-checkout tests require generated runtime artifacts.

Verification:

- `bun test test/detector-interop.test.ts`
- `bun test test/word-counter.test.ts test/command.test.ts`
- `bun run verify:package-contents`
