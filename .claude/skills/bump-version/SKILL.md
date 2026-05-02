---
name: bump-version
description: Bump the RedditGrab extension version, build distribution zips for Chrome and Firefox, and create the GitHub release. Use when the user asks to bump version, release, ship, publish, or prepare a new version of the extension.
---

# Bump Version

Releasing a new version of RedditGrab. `package.json` is the single source of truth — WXT auto-reads it for `manifest.version`, and the sidebar footer reads it via `browser.runtime.getManifest().version` at runtime.

## Steps

Given a target version `X.Y.Z` (semver — patch for bug fixes, minor for features):

1. **Verify clean tree** — releases should be a dedicated branch with only the version bump.
2. **Create branch** named `X.Y.Z` (matches the project's existing convention — see `git log --oneline` for past version commits like `1.0.13`, `1.0.12`).
3. **Bump `package.json`** — update the `"version"` field. That's the only file to touch.
4. **Verify nothing else references the old version** — quick sanity grep:
   ```
   Grep pattern="<previous-version>" path=<repo> (excluding node_modules and pnpm-lock.yaml)
   ```
   `pnpm-lock.yaml` may legitimately contain `1.0.X`-looking strings inside dep versions (e.g. `filesize@11.0.13`) — ignore those. If anything else hardcodes the version, that's a regression — the work to consolidate to package.json was done in PR #26 and shouldn't be undone.
5. **Commit** with message `X.Y.Z` (bare version number, matches existing convention).
6. **Push the branch** and open a PR titled `X.Y.Z`. Body briefly lists what's included (referenced PRs/issues).
7. **Build zips:**
   ```
   pnpm zip          # Chrome  → .output/redditgrab-X.Y.Z-chrome.zip
   pnpm zip:firefox  # Firefox → .output/redditgrab-X.Y.Z-firefox.zip + sources.zip
   ```
8. **Confirm filenames** include the new version. If WXT emits `redditgrab-<old>-...zip`, the bump didn't take — recheck `package.json`.
9. **Squash-merge the PR** (admin override required — branch protection blocks self-review):
   ```
   gh pr merge <num> -R sebastianwd/redditgrab --squash --delete-branch --admin
   ```
10. **Create GitHub release** with all three zips attached:
    ```
    gh release create vX.Y.Z -R sebastianwd/redditgrab \
      --title "X.Y.Z" \
      --notes "<release notes>" \
      .output/redditgrab-X.Y.Z-chrome.zip \
      .output/redditgrab-X.Y.Z-firefox.zip \
      .output/redditgrab-X.Y.Z-sources.zip
    ```
11. **Report the zip paths and release URL** to the user — they upload to Chrome Web Store + AMO manually.

## Verification before reporting "done"

- [ ] `package.json` shows new version
- [ ] `.output/redditgrab-<new>-chrome.zip` exists
- [ ] `.output/redditgrab-<new>-firefox.zip` exists
- [ ] `.output/redditgrab-<new>-sources.zip` exists (Mozilla requires this for source review)
- [ ] PR merged
- [ ] GitHub release created with all three assets attached

## Notes

- **`wxt.config.ts` does NOT specify `version`** — WXT auto-reads it from `package.json`. If you ever feel the urge to add `version:` to the manifest config, don't. That's the bug we just fixed.
- **The sidebar UI version** comes from `browser.runtime.getManifest().version` at runtime in `components/sidebar-footer.tsx`. Don't hardcode it again.
- **Pre-release suffixes:** WXT handles `1.3.0-alpha2` style versions correctly — strips the suffix into `version_name` and uses the clean number for `version`. Use this for beta releases if needed.
