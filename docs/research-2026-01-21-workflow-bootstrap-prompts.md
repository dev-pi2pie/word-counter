---
title: "Bootstrap GitHub Actions for publish + release workflows"
date: 2026-01-21
status: completed
agent: codex
---

## Goal
Provide reusable, copyable prompts to recreate the publish + release workflows from scratch in a new repo using the current stack (Bun + tsdown + Node.js runtime), plus guidance on what to watch for and troubleshooting tips.

## Key Findings
- A clean baseline includes three workflows: publish to npm, publish to GitHub Packages, and a release notes workflow.
- Tag resolution should sanitize workflow_dispatch inputs to avoid CRLF/whitespace issues.
- Shallow fetch handling should support `shallow_since` and unshallow when needed for accurate branch validation and tag discovery.
- Pre-release detection should be consistent across all workflows to keep release tagging aligned.

## Implications or Recommendations
- Treat workflows as reusable templates: keep registry/auth specifics configurable and separate from core validation logic.
- Standardize the “allowed branch” check logic to avoid accidental divergence between publish workflows.
- Use trusted publishing (OIDC + `--provenance`) for npm when possible; use `GITHUB_TOKEN` for GitHub Packages.

## Prompt Tip
Each prompt below assumes a fresh repo with no workflows. Copy one prompt per action.

```text
Prompt 1 — Create publish-to-npm workflow (from zero)
You have no prior context. Create `.github/workflows/publish-npm-packages.yml` from scratch for a TypeScript CLI built with Bun + tsdown and Node.js runtime. Requirements:
- Trigger on tag pushes and `workflow_dispatch` with inputs: `tag` (required), `shallow_since` (optional).
- Checkout with `fetch-depth: 1` and tag ref when provided.
- Resolve tag: sanitize `inputs.tag` by trimming CRLF/whitespace before writing to `GITHUB_OUTPUT`.
- Ensure tag commit is on main or allowed branches (beta/alpha/canary/dev). Use shallow fetch logic: when `shallow_since` set, use `--shallow-since`; otherwise if repo is shallow, unshallow. Always fetch tags, then fetch main and allowed branches with `--no-tags`.
- Detect prerelease by tag suffix (alpha, beta, rc, canary).
- Setup Bun and Node 20. Use npm trusted publishing with OIDC (`permissions: id-token: write`) and `--provenance` on publish.
- Build via `bun run build`, publish with `npm publish` to registry.npmjs.org, tag prereleases as `next` and apply the specific dist-tag.
Provide the complete workflow file.
```

```text
Prompt 2 — Create publish-to-github-packages workflow (from zero)
You have no prior context. Create `.github/workflows/publish-github-packages.yml` from scratch for a TypeScript CLI built with Bun + tsdown and Node.js runtime. Requirements:
- Trigger on tag pushes and `workflow_dispatch` with inputs: `tag` (required), `shallow_since` (optional).
- Checkout with `fetch-depth: 1` and tag ref when provided.
- Resolve tag: sanitize `inputs.tag` by trimming CRLF/whitespace before writing to `GITHUB_OUTPUT`.
- Ensure tag commit is on main or allowed branches (beta/alpha/canary/dev). Use shallow fetch logic: when `shallow_since` set, use `--shallow-since`; otherwise if repo is shallow, unshallow. Always fetch tags, then fetch main and allowed branches with `--no-tags`.
- Detect prerelease by tag suffix (alpha, beta, rc, canary).
- Setup Bun and Node 20. Use GitHub Packages registry with `scope` set to the repo owner.
- Update package name to `@OWNER/word-counter` before publish.
- Publish with `GITHUB_TOKEN`; prereleases use `next` plus a specific dist-tag.
Provide the complete workflow file.
```

```text
Prompt 3 — Create release workflow (from zero)
You have no prior context. Create `.github/workflows/release.yml` from scratch for a repo using conventional commits and git-cliff. Requirements:
- Trigger on tag pushes and `workflow_dispatch` with inputs: `tag` (required), `shallow_since` (optional).
- Resolve tag with input sanitization.
- Ensure tag commit is on main or allowed branches (beta/alpha/canary/dev) using the same shallow fetch logic as the publish workflows.
- Detect prerelease by tag suffix (alpha, beta, rc, canary).
- Compute a release range: for prereleases, use previous tag from `git describe`; for stable releases, use the latest non-prerelease tag merged into the current tag. If shallow and no `shallow_since`, unshallow and retry.
- Generate release notes via git-cliff action (strip header) and create a GitHub release with prerelease flag.
Provide the complete workflow file.
```

## Troubleshooting (Advanced)
- If tag resolution fails, print `GITHUB_REF` and the resolved tag to confirm expected values.
- If branch validation fails in shallow mode, unshallow explicitly and re-run `git merge-base` checks.
- If npm publish fails with provenance errors, confirm `id-token: write` permissions and `npm` version.
- If GitHub Packages publish fails, validate `scope` and `npm.pkg.github.com` registry settings.
- If release notes are empty, verify the release range and git-cliff config.

## Related Plans
None.
