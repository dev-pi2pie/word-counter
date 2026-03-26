---
title: "investigate npm self-update failure in release workflow"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Identify why the release job failed at `Update npm for trusted publishing` and separate workflow-level causes from runner-level causes.

## Key Findings

- The failing step is the explicit self-update in `.github/workflows/release.yml`:

  ```yaml
  - name: Update npm for trusted publishing
    run: npm install -g npm@latest
  ```

- The failure occurs before `npm publish`, inside the npm CLI bundled with the Node.js toolcache installation selected by `actions/setup-node`.
- The user-provided log points at `/opt/hostedtoolcache/node/22.22.2/.../npm/...` and fails with `MODULE_NOT_FOUND` for npm's internal dependency `promise-retry`.
- That means the npm executable already present on the runner was incomplete or corrupted for that Node.js installation, so the workflow failed while asking the bundled npm to upgrade itself.
- This is not caused by the package artifact, package metadata, or npm authentication. The publish step is never reached.
- Repository history shows the self-update step was carried into `.github/workflows/release.yml` by the release-workflow consolidation on 2026-03-24.
- Repository documentation is inconsistent with the current workflow: `docs/plans/jobs/2026-03-13-publish-npm-trusted-publishing-alignment.md` says npm was pinned, but the corresponding workflow revision still used `npm install -g npm@latest`.
- `actions/setup-node@v6` does not expose an `npm-version` input in its documented inputs, so replacing the current step with `npm-version: 10.9.2` under `setup-node` is not a supported fix.

## Implications

- The immediate trigger is runner/toolcache npm corruption or packaging breakage for the selected Node.js image.
- The repo-side contributing factor is the self-update step, because it forces the workflow to invoke the broken bundled npm before publish.
- The most reliable workflow fix is to stop self-updating npm in the publish job, or to install a specific npm version using a mechanism that does not depend on the already-broken npm executable.

## Evidence

- Current workflow: `.github/workflows/release.yml`
- Self-update step introduced to consolidated release flow in commit `37084fe` (`ci(release): consolidate publish workflows into release`)
- Node pin updated to `22.22.2` later in commit `821715e` (`ci(workflows): patch Node 22 CI/CD pins to 22.22.2`)
- Current package metadata does not enable npm package-manager caching and does not define publish-time npm hooks that would explain this failure.

## Recommended Next Step

Remove the `Update npm for trusted publishing` step from the npm publish job first, then re-run the release. If a newer npm is still required afterward, add an explicit and supported installation path separately after confirming the runner image is healthy.
