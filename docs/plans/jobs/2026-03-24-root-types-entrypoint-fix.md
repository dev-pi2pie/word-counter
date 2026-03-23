---
title: "Fix root package types entrypoint"
created-date: 2026-03-24
modified-date: 2026-03-24
status: completed
agent: codex
---

## What Changed

- Updated `package.json` so the published root types point at `dist/esm/index2.d.mts`, which is the generated root facade that preserves the documented export names.
- Kept the generated `dist/esm/index.d.mts` and `dist/esm/index2.d.mts` outputs unchanged so the build artifacts still reflect the bundler's native output.
- Added a regression test that type-checks default and named imports from `@dev-pi2pie/word-counter`.

## Why

- The declaration bundler emitted the public root facade as `dist/esm/index2.d.mts` because of an internal filename collision, while `dist/esm/index.d.mts` contained minified export aliases. Pointing the package metadata at the generated facade fixes TypeScript consumers without rewriting the emitted build output.

## Verification

- Ran `bun test test/package-types.test.ts`.

## References

- `rolldown-plugin-dts` README documents ESM declaration chunk generation and code-splitting behavior, which aligns with the root facade collision observed here.[^rolldown-plugin-dts]
- TypeScript module documentation explains why `.d.mts` filename/basename correctness matters for ESM package consumers.[^typescript-modules]
- Related ecosystem issue discussing `.d.ts` / `.d.mts` basename expectations for published packages.[^mkdist-138]
- Related ecosystem issue showing consumer-visible breakage when declaration files do not match the runtime module shape.[^rollup-1541]

[^rolldown-plugin-dts]: https://github.com/sxzz/rolldown-plugin-dts
[^typescript-modules]: https://www.typescriptlang.org/docs/handbook/modules/theory.html
[^mkdist-138]: https://github.com/unjs/mkdist/issues/138
[^rollup-1541]: https://github.com/rollup/plugins/issues/1541
