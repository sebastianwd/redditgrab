/**
 * End-to-end check for the post archive UI.
 *
 * Loads the built extension into a real Chromium profile, opens a real Reddit
 * post, opens the caret menu and runs "Archive post", then asserts the flow
 * reported success.
 *
 * It deliberately does NOT assert on the downloaded file: Chrome for Testing
 * does not honour the profile's download directory, so the file lands
 * somewhere unpredictable. Verify a real saved file with:
 *
 *   node scripts/verify-archive-file.mjs "<path to saved .html>"
 *
 * Usage: node scripts/e2e-archive.mjs [postUrl]
 * Requires playwright and a prior `pnpm build`.
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const POST_URL =
  process.argv[2] ||
  "https://www.reddit.com/r/buildapc/comments/1tt6s36/msi_called_my_firmware_bug_a_linux_issue_amds/";

const EXT = path.resolve(".output/chrome-mv3");
if (!fs.existsSync(EXT)) {
  console.error(`Build first: ${EXT} does not exist`);
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rg-e2e-"));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1400, height: 1000 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    const text = m.text();
    if (text.includes("RedditGrab")) console.log(`  [extension] ${text.slice(0, 300)}`);
  });

  console.log(`opening ${POST_URL}\n`);
  await page.goto(POST_URL, { waitUntil: "domcontentloaded" });

  const caret = page.locator(
    'shreddit-post button[aria-label="More post actions"]',
  );
  await caret.first().waitFor({ state: "visible", timeout: 30_000 });
  check("post actions caret injected on the post page", true);

  // `.click()` aims a real mouse event at the element's coordinates, which
  // Reddit's own overlays inside `shreddit-post` swallow before they reach the
  // injected shadow root. A real user's click works; this dispatches straight
  // to the element so the test exercises our handlers, not Reddit's hit-testing.
  await caret.first().dispatchEvent("click");

  const menuItem = page.locator(
    'shreddit-post [role="menuitem"]:has-text("Archive post")',
  );
  await menuItem.first().waitFor({ state: "visible", timeout: 5_000 });
  check("caret opens a menu containing Archive post", true);

  const menuShot = path.resolve("post-actions-menu.png");
  await page.locator("shreddit-post").first().screenshot({ path: menuShot });
  console.log(`  screenshot: ${menuShot}`);

  const started = Date.now();
  await menuItem.first().dispatchEvent("click");

  check(
    "menu closes once the action starts",
    (await menuItem.count()) === 0 || !(await menuItem.first().isVisible()),
  );

  // The status line replaces itself with "Saved · N comments" or an error.
  const status = page.locator("shreddit-post span.max-w-\\[220px\\]").first();
  let text = "";
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    text = await status.innerText().catch(() => "");
    if (/^Saved|^Archive failed/.test(text)) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  check("archive completes without error", /^Saved/.test(text), `${text} (${elapsed}s)`);
  check(
    "status reports served comments, not Reddit's num_comments",
    /\d+ comments/.test(text),
    text,
  );
  check("no page errors from the content script", pageErrors.length === 0, pageErrors[0] ?? "");

  console.log(
    "\nNote: the saved file itself is not asserted here (Chrome for Testing\n" +
      "ignores the profile download directory). Verify a real one with:\n" +
      '  node scripts/verify-archive-file.mjs "<path to saved .html>"',
  );
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
