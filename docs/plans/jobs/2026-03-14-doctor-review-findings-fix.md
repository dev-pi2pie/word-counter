---
title: "Doctor review findings fix"
created-date: 2026-03-14
modified-date: 2026-03-14
status: completed
agent: codex
---

Address follow-up review findings from the doctor command change.

- Preserve existing root counting behavior when the first text token is `doctor`.
- Correct doctor build-channel reporting for prerelease versions beyond canary.
- Tighten the sample `Intl.Segmenter` health probe so empty segmentation is treated as a failure.

Verification plan:

- Add focused CLI and doctor health regression tests in `test/command.test.ts`.
- Run targeted `bun test` coverage for the affected command and doctor flows.
- Run `bun run build` to confirm the packaged CLI still bundles and executes.

Completed:

- Root counting now keeps `doctor` as plain text unless the argv shape is an explicit doctor invocation.
- Doctor help is still available through `word-counter doctor --help`, and root help still advertises the doctor command.
- Doctor build-channel detection now recognizes `alpha`, `beta`, `rc`, and `canary` instead of collapsing all prereleases to `stable`.
- Empty sample segmentation is now treated as a doctor failure instead of being forced to success.

Verification:

- `bun test test/command.test.ts --filter 'CLI doctor diagnostics|CLI jobs diagnostics'`
- `bun run build`
- `node dist/esm/bin.mjs doctor appointment`
- `node dist/esm/bin.mjs doctor --help`
- `node dist/esm/bin.mjs doctor --path /tmp/example`
