# Releasing dsh-context-monitor

`main` is the source for both distribution channels. A stable tag (`vX.Y.Z`) on a commit in `main` runs the [release workflow](.github/workflows/publish.yml): lockfile install, tests, syntax checks, a package-content check, and publication of the same archive to npm and GitHub. A PR, main push or manual workflow run only validates and packs; it does not publish. The plugin has no separate build step.

## Once: connect npm Trusted Publishing

In the [npm package settings](https://www.npmjs.com/package/dsh-context-monitor/access), add a GitHub Actions trusted publisher:

- Owner: `NekogamiJam`
- Repository: `dsh-context-monitor`
- Workflow filename: `publish.yml`
- Environment: blank
- Allow **direct `npm publish`**, not only staged publishing.

Save the binding using npm's authentication flow. After that, releases use GitHub OIDC on a hosted runner; no `NPM_TOKEN` secret or per-release 2FA is needed. Keep account 2FA enabled. The [npm documentation](https://docs.npmjs.com/trusted-publishers/) describes the trust and provenance model.

## Each release

1. Update the version in the manifest and lockfile together (for example, `npm version patch --no-git-tag-version`), then merge the release commit to `main`. Review the validation run before tagging.
2. Tag that commit `vX.Y.Z` using the exact manifest version and push the tag. Wait for the release to finish before pushing another release tag.
3. Check the Actions run, the public npm package and the GitHub Release. Each release carries `dsh-context-monitor.tgz`; GitHub's `releases/latest/download/dsh-context-monitor.tgz` stays stable. Fixed historical Release links remain valid.

If npm succeeds but GitHub Release fails, rerun the failed jobs on the same tag. The workflow accepts an existing npm version only if its registry integrity matches the CI archive. It does not replace a conflicting package or Release asset. If an integrity check fails, inspect before taking action; never move a published tag to retry it. If the CI artifact has expired, a full rebuild must match the already published npm integrity before the workflow can continue.

The market reads npm metadata on its own refresh cycle; there is no per-release catalog edit. The stable fallback URL follows the GitHub latest Release, so it does not supply fixed-tag `releaseManifest` metadata.
