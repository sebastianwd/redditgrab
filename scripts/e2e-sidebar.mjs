/**
 * Renders the side panel with a Reddit tab active and screenshots both modes,
 * so the Media/Archive switch can be reviewed without opening the real panel.
 *
 *   node scripts/e2e-sidebar.mjs
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const EXT = path.resolve(".output/chrome-mv3");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rg-side-"));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 420, height: 1000 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-first-run"],
});

try {
  // A Reddit tab has to be the active one, or the panel shows its
  // "only works on Reddit" state instead of the controls.
  const redditTab = ctx.pages()[0] ?? (await ctx.newPage());
  await redditTab.goto("https://www.reddit.com/r/buildapc/", {
    waitUntil: "domcontentloaded",
  });

  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const extensionId = new URL(sw.url()).host;

  const panel = await ctx.newPage();
  const errors = [];
  panel.on("pageerror", (e) => errors.push(String(e)));
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await redditTab.bringToFront();
  await panel.waitForTimeout(1500);

  const mediaTab = panel.locator('[role="tab"]:has-text("Media")');
  const archiveTab = panel.locator('[role="tab"]:has-text("Archive")');
  check("mode switch renders both tabs", (await mediaTab.count()) === 1 && (await archiveTab.count()) === 1);

  check(
    "media mode is the default",
    (await mediaTab.getAttribute("aria-selected")) === "true" &&
      (await panel.locator('button:has-text("Start Mass Download")').count()) === 1,
  );
  await panel.screenshot({ path: path.resolve("sidebar-media.png"), fullPage: true });

  await archiveTab.click();
  await panel.waitForTimeout(300);
  check(
    "archive mode shows its own start button",
    (await panel.locator('button:has-text("Start Mass Archive")').count()) === 1,
  );
  check(
    "mass download button is hidden in archive mode",
    !(await panel.locator('button:has-text("Start Mass Download")').first().isVisible()),
  );
  check(
    "archive options render",
    (await panel.locator("#archive-inline-media").count()) === 1 &&
      (await panel.locator("#archive-inline-video").count()) === 1 &&
      (await panel.locator("#mass-archive-scroll-up").count()) === 1,
  );
  await panel.screenshot({ path: path.resolve("sidebar-archive.png"), fullPage: true });

  check("no runtime errors in the panel", errors.length === 0, errors[0] ?? "");
  console.log("\nscreenshots: sidebar-media.png, sidebar-archive.png");
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
