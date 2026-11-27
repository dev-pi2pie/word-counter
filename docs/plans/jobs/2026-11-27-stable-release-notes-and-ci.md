---
title: "Curate stable release notes and verify release CI"
created-date: 2026-11-27
status: completed
agent: codex
---

Added the [stable release notes policy](../../../RELEASE_NOTES_POLICY.md) and drafted the [v0.2.0 release body](../../../CHANGELOGS/v0.2.0.md) from the `v0.1.9` stable baseline. The draft records PRs #67 and #69.

The [release workflow](../../../.github/workflows/release.yml) selects the Markdown from the tagged commit, falls back to the hybrid generator when the file is missing, and rejects a blank matching file.

Local fixtures ran the release workflow's Bash steps and confirmed that the tagged draft wins over a dispatch-branch copy. With no matching tagged file, the hybrid generator received the resolved stable range. Blank and non-regular entries failed, and the canary selected the prerelease body. Multiline Markdown reached both stubbed `gh release` paths through `--notes-file`.

`actionlint`, ShellCheck, `git diff --check`, and all 40 focused counting tests passed. Intercepted requests also verified GitHub API authentication and credential handling for the generator.
