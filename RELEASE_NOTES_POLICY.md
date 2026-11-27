# Stable Release Notes Policy

## Filename format

Save each curated stable release note as `CHANGELOGS/v<major>.<minor>.<patch>.md`. Use the exact intended stable tag, including the lowercase `v` and all three numeric version components, followed by `.md`. For example, `v0.2.0` maps to [`CHANGELOGS/v0.2.0.md`](CHANGELOGS/v0.2.0.md).

| Example filename | Required correction |
| --- | --- |
| `0.2.0.md` | Add the `v` prefix |
| `v0.2.md` | Include the patch version |
| `v0.2.0-canary.3.md` | Use the stable tag `v0.2.0` |

## Draft a stable release note

1. Preview the changes from the previous stable tag through the release candidate using the [local preview script](docs/notes/release-notes-local-verification.md) in `hybrid` mode. For this example, `HEAD` is the `v0.2.0` release candidate. The explicit range lets you draft before the new tag exists.

   ```bash
   scripts/local-release-verification.sh \
     --mode hybrid \
     --range v0.1.9..HEAD \
     --previous-tag v0.1.9 \
     --current-tag v0.2.0 \
     --repository dev-pi2pie/word-counter
   ```

2. Create the matching Markdown file under `CHANGELOGS/`. Start with `## What's Changed` and describe the final shipped behavior. Combine intermediate fixes that led to the same outcome. Include compatibility and maintenance changes when they affect users.
3. Under `### Changelog`, list the essential PRs. Use the generated PR list as a starting point, verify each selected PR against the stable range, and give it a short description of the outcome and a direct link. Include contributor attribution when verified and useful.
4. If there is a previous stable tag, end with `Full Changelog: https://github.com/dev-pi2pie/word-counter/compare/<previous-stable-tag>...<current-stable-tag>`.

Write the complete GitHub release body as Markdown and omit front matter.

## CI selection

- For a stable tag, CI reads the matching non-empty Markdown file from the tagged commit. This applies to tag pushes and manual dispatches.
- If the tagged commit has no exact match, CI runs the [stable notes generator](scripts/generate-stable-release-notes.sh) in `hybrid` mode with the resolved release range.
- An empty or whitespace-only file, or a non-regular entry at the matching path, fails the stable notes step.
- Prerelease notes come from `git-cliff`.
