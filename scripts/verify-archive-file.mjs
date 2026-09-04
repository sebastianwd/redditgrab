/**
 * Verifies a saved archive file the way a user would actually open it: from
 * file://, in Chromium and Firefox, with JavaScript both on and off.
 *
 *   node scripts/verify-archive-file.mjs "C:/path/to/Some post (abc123).html"
 *
 * Checks the properties the format is supposed to guarantee: self-contained,
 * makes no network requests, comments collapse without JavaScript, encoding
 * survives, and it prints with the comments expanded.
 */

import { chromium, firefox } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target || !fs.existsSync(target)) {
  console.error("Usage: node scripts/verify-archive-file.mjs <path to saved .html>");
  process.exit(1);
}

const file = path.resolve(target);
const html = fs.readFileSync(file, "utf8");
const bytes = fs.statSync(file).size;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log(`\n${path.basename(file)} — ${(bytes / 1024 / 1024).toFixed(2)} MB\n`);

// ---- static checks on the bytes ----
const inlineImages = (html.match(/src="data:image/g) || []).length;
const inlineVideos = (html.match(/src="data:video/g) || []).length;
const comments = (html.match(/<details open/g) || []).length;

check("self-contained: styles are inline", html.includes("<style>"));
check("no external stylesheet", !/<link[^>]+stylesheet/i.test(html));
check("no scripts in the artifact", !/<script/i.test(html));
check(
  "no live reddit media URLs in src attributes",
  !/src="https?:\/\/[^"]*(redd\.it|redditmedia)/i.test(html),
);
check("never renders 'N of M' comment counts", !/\d+\s+of\s+\d+\s+comments/i.test(html));
console.log(
  `  (${comments} comments, ${inlineImages} embedded images, ${inlineVideos} embedded videos)\n`,
);

// ---- behavioural checks in real browsers ----
async function run(engine, name, javaScriptEnabled) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    javaScriptEnabled,
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  const net = [];
  page.on("request", (r) => {
    const url = r.url();
    if (!url.startsWith("file://") && !url.startsWith("data:")) net.push(url);
  });

  const tag = `${name}, JS ${javaScriptEnabled ? "on" : "off"}`;
  await page.goto(pathToFileURL(file).href);

  check(`[${tag}] makes no network requests`, net.length === 0, net.slice(0, 2).join(", "));

  const first = page.locator(".rg-comments details").first();
  if ((await first.count()) > 0) {
    const openVisible = await first.locator(".rg-cbody").first().isVisible();
    await first.locator("summary").first().click();
    const closedVisible = await first.locator(".rg-cbody").first().isVisible();
    check(`[${tag}] comments collapse via <details>`, openVisible && !closedVisible);
    await first.locator("summary").first().click();
  }

  const title = await page.locator("h1").first().innerText();
  check(`[${tag}] title renders without mojibake`, !/�/.test(title), title.slice(0, 50));

  if (javaScriptEnabled) {
    await page.emulateMedia({ media: "print" });
    const visible =
      (await page.locator(".rg-cbody").count()) === 0 ||
      (await page.locator(".rg-cbody").first().isVisible());
    check(`[${name}] comments stay visible under print media`, visible);
    await page.emulateMedia({ media: "screen" });

    const shot = path.resolve(`archive-verify-${name}.png`);
    await page.screenshot({ path: shot });
    console.log(`  screenshot: ${shot}`);
  }

  await browser.close();
}

await run(chromium, "chromium", true);
await run(chromium, "chromium", false);
await run(firefox, "firefox", true);
await run(firefox, "firefox", false);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
