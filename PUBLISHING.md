# Publishing

Store submission is automated with [`wxt submit`](https://wxt.dev/guide/essentials/publishing) via the **Submit to stores** GitHub Action (`.github/workflows/submit.yml`).

## Release flow

1. Bump the version and create the GitHub release (see the `bump-version` process / release skill).
2. Go to **Actions → Submit to stores → Run workflow**.
3. Run once with **Dry run** checked to validate credentials.
4. Run again with Dry run unchecked to submit for review. Approved versions publish automatically.

The workflow rebuilds the ZIPs in CI (`pnpm zip` + `pnpm zip:firefox`) and submits the Chrome ZIP to the Chrome Web Store and the Firefox ZIP + sources ZIP to Firefox Add-ons.

## Local submission (optional)

Run from a POSIX shell (Git Bash / WSL) so the ZIP globs expand:

```sh
pnpm zip && pnpm zip:firefox
pnpm wxt submit --dry-run \
  --chrome-zip .output/*-chrome.zip \
  --firefox-zip .output/*-firefox.zip --firefox-sources-zip .output/*-sources.zip
# drop --dry-run to actually submit
```

Local runs read credentials from `.env.submit` (generate it with `pnpm wxt submit init`). **Do not commit `.env.submit`.**

## Required GitHub secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|--------|-----------------|
| `CHROME_EXTENSION_ID` | Chrome Web Store item ID |
| `CHROME_CLIENT_ID` | Google Cloud OAuth client (Chrome Web Store API) |
| `CHROME_CLIENT_SECRET` | same OAuth client |
| `CHROME_REFRESH_TOKEN` | generated for that OAuth client |
| `FIREFOX_EXTENSION_ID` | AMO add-on ID (e.g. `{uuid}` or `name@domain`) |
| `FIREFOX_JWT_ISSUER` | AMO → Manage API Keys → JWT issuer |
| `FIREFOX_JWT_SECRET` | AMO → Manage API Keys → JWT secret |

The easiest way to obtain the Chrome and Firefox values is to run `pnpm wxt submit init` locally and follow the prompts; it walks through each credential and writes them to `.env.submit`, from which you copy them into the repo secrets.

Chrome Web Store API setup: https://developer.chrome.com/docs/webstore/using-api
Firefox AMO API keys: https://addons.mozilla.org/developers/addon/api/key/
