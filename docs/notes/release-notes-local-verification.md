# Stable Release Notes Local Verification

Use `scripts/local-release-verification.sh` for a quick local preview before running CI.

Current CI default for stable release notes is `--mode hybrid`.

## Quick Run

```bash
scripts/local-release-verification.sh
```

## Provide Token for Account Resolution

```bash
# zsh/bash
export GH_TOKEN="$(gh auth token)"

# fish
set -x GH_TOKEN (gh auth token)
```

## Compare `commit` vs `pr` Mode

```bash
scripts/local-release-verification.sh --mode commit --output /tmp/release-notes-commit.md
scripts/local-release-verification.sh --mode pr --output /tmp/release-notes-pr.md
diff -u /tmp/release-notes-commit.md /tmp/release-notes-pr.md
```

## Compare `hybrid` vs `pr` Mode

```bash
scripts/local-release-verification.sh --mode hybrid --output /tmp/release-notes-hybrid.md
scripts/local-release-verification.sh --mode pr --output /tmp/release-notes-pr.md
diff -u /tmp/release-notes-hybrid.md /tmp/release-notes-pr.md
```

## Save Preview to a File

```bash
scripts/local-release-verification.sh \
  --mode "commit" \
  --current-tag "v0.1.3" \
  --repository "<owner>/<repo>" \
  --output /tmp/stable-release-notes-preview.md
```

## Force Fallback Login (Local Preview)

Use this when your local/API login resolution is unavailable but you want output to use a specific GitHub account.

```bash
scripts/local-release-verification.sh \
  --mode "commit" \
  --fallback-login "@your-account-name" \
  --output /tmp/stable-release-notes-preview.md
```

This is the recommended fallback when:
- `--show-inputs` reports `auth-token: present` but contributor lines still render local author names.
- GitHub API does not resolve `author.login` / `committer.login` for older or differently authored commits.

## Useful Flags

```bash
# show resolved inputs (current/previous tag and range)
scripts/local-release-verification.sh --show-inputs

# switch render mode
scripts/local-release-verification.sh --mode pr --show-inputs
scripts/local-release-verification.sh --mode hybrid --show-inputs

# fallback contributor login when API resolution fails
scripts/local-release-verification.sh --fallback-login @your-account-name --show-inputs

# override previous tag
scripts/local-release-verification.sh --current-tag "v0.1.3" --previous-tag "v0.1.2"

# force custom range
scripts/local-release-verification.sh --current-tag "v0.1.3" --range "abc123..def456"

# write directly to file
scripts/local-release-verification.sh --output /tmp/stable-release-notes-preview.md
```

## Under the Hood

- `scripts/local-release-verification.sh` resolves tag/range inputs.
- It then calls `scripts/generate-stable-release-notes.sh` to render final markdown.

## Why Local and CI Can Differ (PR Mode)

Differences are usually caused by one of these:
- Different release range (auto-resolved locally vs fixed range in CI).
- Different auth context (`GH_TOKEN`/`GITHUB_TOKEN` availability, token scopes, rate limits).
- Different mode (`commit`, `pr`, `hybrid`).
- Local fallback flags in use (for example, `--fallback-login`) that CI does not use.
- Stale local tags/history.

To compare with CI behavior, run with explicit inputs:

```bash
git fetch --tags --prune origin

GH_TOKEN="<token>" scripts/generate-stable-release-notes.sh \
  --mode "pr" \
  --range "<from-commit>..<to-commit>" \
  --current-tag "<current-tag>" \
  --previous-tag "<previous-tag>" \
  --repository "<owner>/<repo>"
```

For parity checks, do not pass `--fallback-login`.

## Notes

- Stable note generation excludes merge commits (`git log --no-merges`).
- GitHub login/PR lookups use GitHub REST API (`curl` + `jq`), not `gh` CLI.
- For reliable account resolution, set `GH_TOKEN` or `GITHUB_TOKEN` (otherwise public API rate limits may apply).
- Contributor attribution is shown in `### Changelog` lines (`... by @login`) when resolved.
- Optional `--fallback-login` can force unresolved contributors to a specific `@login`.
- `### Changelog` uses a non-list metadata line: `Full Changelog: <range-or-compare-link>`.
- In `--mode pr`, lines include per-item contributor attribution:
  - Prefer `@login` resolved from GitHub PR metadata when available.
  - Fall back to plain local author text when GitHub login resolution is unavailable.
- Commit login lookup also attempts email-based user search as a fallback when direct commit/PR login resolution is unavailable.
