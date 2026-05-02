---
name: bump-version
description: Bump the RedditGrab extension version across all the places that hardcode it, then build distribution zips for Chrome and Firefox. Use when the user asks to bump version, release, ship, publish, or prepare a new version of the extension.
---

# Bump Version

Releasing a new version of RedditGrab requires updating **three** files that all hardcode the version string. Missing any of them ships a broken release (wrong version in the manifest, wrong version in the UI, or store rejection).

## The three places version lives

1. **`package.json`** — `"version"` field. npm/pnpm metadata.
2. **`wxt.config.ts`** — `manifest.version` field. This is what WXT writes into the actual extension `manifest.json` and what determines the zip filename. **The store reads this.**
3. **`components/sidebar-footer.tsx`** — `RedditGrab v<version>` displayed to the user in the sidepanel footer.

If you only update some of them, you ship inconsistent state. The store sees one version, users see another.

## Steps

Given a target version `X.Y.Z` (use semver — patch for bug fixes, minor for features, major never so far):

1. **Verify clean tree** — bail if there are uncommitted changes that aren't part of the release. Releases should be a dedicated branch with only the version bump.
2. **Create branch** named `X.Y.Z` (matches the project's existing convention — see `git log --oneline` for past version commits like `1.0.13`, `1.0.12`, etc.).
3. **Update all three files** to the new version string. Use Edit, not Write — preserve everything else.
4. **Verify** — grep the repo for the previous version string to make sure no occurrence was missed:
   ```
   Grep pattern="<previous-version>" path="<repo>" (excluding node_modules and pnpm-lock.yaml)
   ```
   pnpm-lock.yaml may legitimately contain `1.0.X`-looking strings inside dep versions (e.g. `filesize@11.0.13`) — ignore those.
5. **Commit** with message `X.Y.Z` (single-line, matches existing convention — past commits are bare version numbers).
6. **Push the branch** and open a PR titled `X.Y.Z`. Body should briefly list what's included (referenced PRs/issues).
7. **Build zips:**
   ```
   pnpm zip          # Chrome (.output/redditgrab-X.Y.Z-chrome.zip)
   pnpm zip:firefox  # Firefox (.output/redditgrab-X.Y.Z-firefox.zip + sources.zip)
   ```
8. **Confirm filenames** include the new version — if WXT emits `redditgrab-<old>-chrome.zip`, `wxt.config.ts` wasn't bumped. Fix and re-zip.
9. **Report the zip paths** to the user so they can upload to Chrome Web Store + AMO.

## Verification before reporting "done"

Always run this check before telling the user the release is built:

- [ ] `package.json` shows new version
- [ ] `wxt.config.ts` `manifest.version` shows new version
- [ ] `components/sidebar-footer.tsx` shows new version
- [ ] `.output/redditgrab-<new>-chrome.zip` exists
- [ ] `.output/redditgrab-<new>-firefox.zip` exists
- [ ] `.output/redditgrab-<new>-sources.zip` exists (Mozilla requires this for source review)
- [ ] No `<previous-version>` strings remain (excluding lockfile noise)

## Notes

- **Don't merge the version-bump PR until the user confirms the stores accepted the upload.** If a store rejects, you may need to amend (e.g. fix a manifest issue) before merging.
- **Source-of-truth follow-up:** the duplication between `package.json`, `wxt.config.ts`, and `sidebar-footer.tsx` is fragile. A future improvement is to read the version from `package.json` in both `wxt.config.ts` (via import) and `sidebar-footer.tsx` (via `import.meta.env` or WXT's `browser.runtime.getManifest().version`). If the user asks for it, propose this as a one-shot refactor — but do not slip it into a release commit.
