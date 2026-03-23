---
title: "Release workflow consolidation and artifact reuse"
created-date: 2026-03-24
modified-date: 2026-03-24
status: active
agent: Codex
---

## Goal

Reduce duplicated Rust/WASM build work across release and publish automation by building publishable artifacts once per release run and reusing them for both npm and GitHub Packages publication.

## Scope

- In scope:
  - Review the current split between `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/publish-npm-packages.yml`, and `.github/workflows/publish-github-packages.yml`.
  - Define a single release orchestration flow that prepares one verified build artifact and reuses it for both registries.
  - Keep branch and tag validation behavior aligned with the current release policy.
  - Preserve registry-specific publish behavior such as npm trusted publishing and GitHub Packages package-name rewriting.
  - Reduce YAML duplication where practical without obscuring release logic.
- Out of scope:
  - Changing package contents or the current WASM packaging model.
  - Changing versioning or dist-tag policy.
  - Replacing GitHub Releases notes generation logic unless required by consolidation.
  - Removing CI validation for pull requests and integration branches.

## Current Problem

- The current tag-based release path fans out into three separate workflows:
  - `.github/workflows/release.yml`
  - `.github/workflows/publish-npm-packages.yml`
  - `.github/workflows/publish-github-packages.yml`
- Both publish workflows repeat the same expensive setup and build work:
  - Bun setup
  - Node setup
  - Rust toolchain setup
  - `wasm-pack` install
  - dependency install
  - `bun run build`
  - `bun run verify:package-contents`
- Cross-workflow artifact sharing is technically possible, but it adds avoidable complexity around matching tag runs, artifact lookup, reruns, and retention.

## Recommended Direction

- Keep `.github/workflows/ci.yml` as the validation workflow for pull requests and selected push branches.
- Turn `.github/workflows/release.yml` into the single tag/manual release orchestrator.
- Build once inside `release.yml`, upload one verified release artifact, and let both publish jobs consume it in the same workflow run.
- Remove `.github/workflows/publish-npm-packages.yml` and `.github/workflows/publish-github-packages.yml` after the consolidated release flow is proven.

## Target Workflow Shape

### CI Workflow

- Trigger on:
  - `pull_request`
  - selected `push` branches such as `main`, `dev*`, `canary*`, `alpha*`, and `beta*`
- Purpose:
  - validate type-check, build, tests, and packaged contents
  - do not publish
  - do not act as the source of release artifacts for later workflows

### Release Workflow

- Trigger on:
  - tag `push`
  - `workflow_dispatch`
- Jobs:
  - `notes`
    - resolve tag
    - validate allowed branch ancestry
    - generate release notes
  - `prepare`
    - checkout the release ref
    - setup Bun, Node, Rust, and `wasm-pack`
    - install dependencies
    - run `bun run build`
    - run `bun run verify:package-contents`
    - upload a release artifact that includes the built publish surface
  - `publish_npm`
    - depends on `prepare`
    - downloads the prepared build artifact
    - performs npm trusted publishing
  - `publish_github_packages`
    - depends on `prepare`
    - downloads the same prepared build artifact
    - applies GitHub Packages package-name override
    - publishes to `npm.pkg.github.com`
  - `release`
    - depends on `notes`
    - creates the GitHub release record

## Artifact Strategy

- Share artifacts inside the same `release.yml` workflow run instead of across workflows.
- Upload only the publish-relevant outputs and metadata needed by downstream jobs, for example:
  - `dist/`
  - `package.json`
  - `README.md`
  - `LICENSE*`
- Do not upload `node_modules`.
- Keep registry-specific mutation outside the shared artifact when possible:
  - npm publish can use the prepared package view directly
  - GitHub Packages can apply package-name rewriting in its own job after artifact download

## Phase Task Items

### Phase 1 - Release Flow Design

- [x] Confirm the final job graph for `release.yml`.
- [x] Decide whether the `release` job should depend only on `notes` or on successful publication jobs as well.
- [x] Define the exact artifact contents required by both registry jobs.
- [x] Define artifact naming so reruns and prereleases stay easy to inspect.
- [x] Decide whether tag and branch validation should stay in `notes`, move to `prepare`, or be extracted into a shared job.

### Phase 2 - Workflow Consolidation

- [x] Move shared release-build logic into `.github/workflows/release.yml`.
- [x] Add a single `prepare` job that builds and verifies the package once.
- [x] Add artifact upload and download steps for downstream publish jobs.
- [x] Move npm publish logic into a `publish_npm` job inside `release.yml`.
- [x] Move GitHub Packages publish logic into a `publish_github_packages` job inside `release.yml`.
- [x] Keep npm trusted publishing permissions and token handling intact.
- [x] Keep GitHub Packages registry and package-name override behavior intact.

### Phase 3 - Cleanup and Deduplication

- [x] Remove `.github/workflows/publish-npm-packages.yml` after the consolidated flow is validated.
- [x] Remove `.github/workflows/publish-github-packages.yml` after the consolidated flow is validated.
- [x] Recheck whether any shared setup should move into a composite action or reusable workflow for readability only.
- [x] Recheck whether `ci.yml` and `release.yml` should share any common helper logic for setup or verification.

### Phase 4 - Validation and Rollout

- [ ] Validate that stable and prerelease tags still route to the correct publish behavior.
- [ ] Validate that the built WASM runtime is present in the downloaded release artifact and in final published package contents.
- [ ] Validate that manual `workflow_dispatch` still supports explicit `tag` and optional `shallow_since`.
- [ ] Validate rerun behavior for failed publish jobs without requiring a second full build unless the source ref changed.
- [x] Add or update documentation for the new workflow responsibilities and trigger model.

## Design Notes

- Prefer same-workflow artifact reuse over `workflow_run` chaining.
- Avoid making `.github/workflows/ci.yml` the producer of release artifacts because CI runs are not release-scoped and are triggered by different events.
- Favor one authoritative release workflow over three independent tag-triggered workflows.
- Keep the release artifact narrow and deterministic so registry jobs publish the same build output.
- Keep tag and branch validation in the `notes` job for now so release-note generation and publish gating continue to share the same resolved tag context.
- Make the `release` job depend on successful registry jobs so a GitHub Release record is not created for a failed publication run.

## Success Criteria

- A tag or manual release run builds publishable artifacts exactly once.
- npm and GitHub Packages publishing reuse the same prepared build output from the same workflow run.
- Release notes and publish gates remain consistent with the current branch and prerelease policy.
- `ci.yml` continues to provide non-release validation without becoming part of the release artifact chain.
- The old duplicate publish workflows can be removed without losing current behavior.

## Related Plans

- `docs/plans/plan-2026-01-21-publish-flow-checkout.md`
- `docs/plans/plan-2026-03-23-wasm-language-detector-implementation.md`

## Related Research

- `docs/researches/research-2026-03-23-wasm-packaging-repo-structure.md`
