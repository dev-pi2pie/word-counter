---
title: "Investigate GitHub Actions failure for release/publish"
created-date: 2026-01-16
status: completed
agent: codex
---

## Goal

Identify why the referenced GitHub Actions job failed and document actionable fixes based on repository workflows and the provided log excerpt.

## Key Findings

- Direct access to the GitHub Actions job log was blocked in this environment (HTTP 403), so analysis used repository workflow definitions plus the log excerpt provided by the requester.
- The failure occurs in the `Publish` step of the npm workflow when `npm publish` completes but `npm` returns `E401 Unable to authenticate` for the registry, indicating an invalid or classic token was used instead of OIDC trusted publishing.
- The publish workflow inherited `NODE_AUTH_TOKEN` during the run, which forces npm to use token-based auth instead of OIDC trusted publishing.

## Log Evidence (Publish Step)

### Part 1

```
if [[ "true" == "true" ]]; then
  npm publish --registry https://registry.npmjs.org --access public --provenance --tag next
  PKG_NAME=$(node -p "require('./package.json').name")
  PKG_VERSION=$(node -p "require('./package.json').version")
  npm dist-tag add "$PKG_NAME@$PKG_VERSION" "canary" --registry https://registry.npmjs.org
else
  npm publish --registry https://registry.npmjs.org --access public --provenance
fi
shell: /usr/bin/bash -e {0}
env:
  NPM_CONFIG_USERCONFIG: /home/runner/work/_temp/.npmrc
  NODE_AUTH_TOKEN: XXXXX-XXXXX-XXXXX-XXXXX
```

## Recommendations

1. Replace token-based npm authentication with npm OIDC Trusted Publishing for GitHub Actions.
   - Register the repository in npm as a Trusted Publisher and remove reliance on long-lived `NODE_AUTH_TOKEN` secrets.
   - Keep `id-token: write` and `npm publish --provenance` so npm can verify the workflow identity.
2. Update the workflow to clear any inherited `NODE_AUTH_TOKEN` so npm uses OIDC instead of a legacy token.
3. Re-run the tag build after OIDC setup to confirm the `Publish` step succeeds with provenance.
