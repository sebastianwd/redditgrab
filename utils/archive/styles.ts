/**
 * Stylesheet for the generated archive document, inlined into a `<style>` tag
 * so the output is a single self-contained file. Hand written, no framework.
 * Scoped under `.rg-archive` so it can never leak into a host page if the same
 * markup is ever previewed inside the extension UI.
 */
export const ARCHIVE_CSS = `
:root {
  --rg-bg: #fdfaf5; --rg-panel: #fffdf9; --rg-ink: #2b2b28; --rg-ink-soft: #6b675f;
  --rg-line: #e3ddd1; --rg-accent: #c2571a; --rg-gone: #9a948a; --rg-rail: #e0d9cc;
}
@media (prefers-color-scheme: dark) {
  :root {
    --rg-bg: #16161a; --rg-panel: #1c1c21; --rg-ink: #e6e3dc; --rg-ink-soft: #9d988e;
    --rg-line: #2e2e35; --rg-accent: #ff8a3d; --rg-gone: #6e6a63; --rg-rail: #33333b;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--rg-bg); color: var(--rg-ink);
  font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans",
        "Noto Sans Arabic", "Noto Sans SC", sans-serif;
}
a { color: var(--rg-accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.rg-archive { max-width: 860px; margin: 0 auto; padding: 28px 20px 80px; }
h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 8px; }
h2 { font-size: 1.05rem; margin: 32px 0 12px; color: var(--rg-ink-soft); font-weight: 600; }
.rg-sep { color: var(--rg-gone); }
.rg-meta, .rg-links { color: var(--rg-ink-soft); font-size: 14px; margin: 4px 0; }
.rg-author { font-weight: 600; }
.rg-badge {
  display: inline-block; font-size: 11px; line-height: 1.4; padding: 0 5px;
  margin-inline-start: 5px; border: 1px solid var(--rg-line); border-radius: 3px;
  color: var(--rg-ink-soft); vertical-align: 1px;
}
.rg-op { color: #fff; background: var(--rg-accent); border-color: var(--rg-accent); }
.rg-mod { color: #fff; background: #2e7d5b; border-color: #2e7d5b; }
.rg-admin, .rg-nsfw { color: #fff; background: #b03030; border-color: #b03030; }
.rg-flair {
  display: inline-block; font-size: 11px; padding: 0 6px; margin-inline-start: 6px;
  border-radius: 10px; background: var(--rg-rail); color: var(--rg-ink-soft);
}
.rg-selftext, .rg-cbody { overflow-wrap: anywhere; }
.rg-selftext p, .rg-cbody p { margin: 0 0 10px; }
.rg-selftext > :last-child, .rg-cbody > :last-child { margin-bottom: 0; }
blockquote {
  margin: 10px 0; padding: 2px 0 2px 12px;
  border-inline-start: 3px solid var(--rg-rail); color: var(--rg-ink-soft);
}
pre {
  background: var(--rg-panel); border: 1px solid var(--rg-line); border-radius: 4px;
  padding: 10px 12px; overflow-x: auto; font-size: 13px;
}
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
:not(pre) > code { background: var(--rg-rail); padding: 1px 4px; border-radius: 3px; }
table { border-collapse: collapse; margin: 12px 0; font-size: 14px; }
th, td { border: 1px solid var(--rg-line); padding: 5px 9px; text-align: start; }
th { background: var(--rg-rail); }
hr { border: 0; border-top: 1px solid var(--rg-line); margin: 16px 0; }
.md-spoiler-text { background: var(--rg-ink); color: transparent; border-radius: 2px; }
.md-spoiler-text:hover, .md-spoiler-text:focus, .md-spoiler-text:active {
  background: var(--rg-rail); color: inherit;
}
.rg-selftext img, .rg-cbody img { max-width: 100%; height: auto; }
.rg-imglink { font-size: 13px; }
.rg-media { margin: 14px 0; }
.rg-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
figure { margin: 0; }
figure img, figure video {
  display: block; max-width: 100%; height: auto; border: 1px solid var(--rg-line);
  border-radius: 4px; background: var(--rg-rail);
}
.rg-placeholder {
  border: 1px dashed var(--rg-line); border-radius: 4px; padding: 22px 12px;
  text-align: center; color: var(--rg-ink-soft); font-size: 13px;
}
figcaption { font-size: 12px; color: var(--rg-ink-soft); margin-top: 4px; }
.rg-comments details {
  border-inline-start: 2px solid var(--rg-rail); padding-inline-start: 10px; margin: 8px 0;
}
.rg-comments summary {
  cursor: pointer; list-style: none; font-size: 13px; color: var(--rg-ink-soft); padding: 2px 0;
}
.rg-comments summary::-webkit-details-marker { display: none; }
.rg-comments summary::before {
  content: "\\25BE"; display: inline-block; width: 1em; margin-inline-end: 2px; color: var(--rg-gone);
}
.rg-comments details:not([open]) > summary::before { content: "\\25B8"; }
.rg-comments details:not([open]) > summary { opacity: .75; }
.rg-comments summary:hover { color: var(--rg-ink); }
.rg-cbody { margin: 4px 0 2px; font-size: 15px; }
.rg-replies { margin-inline-start: 6px; }
.rg-gone > summary, .rg-gone-label { color: var(--rg-gone); font-style: italic; }
.rg-note {
  margin-top: 24px; padding: 10px 12px; border: 1px solid var(--rg-line); border-radius: 4px;
  background: var(--rg-panel); font-size: 14px; color: var(--rg-ink-soft);
}
@media print {
  :root {
    --rg-bg: #fff; --rg-panel: #fff; --rg-ink: #000; --rg-ink-soft: #444;
    --rg-line: #bbb; --rg-rail: #ddd; --rg-gone: #666;
  }
  body { font-size: 11pt; }
  .rg-archive { max-width: none; padding: 0; }
  a { color: #000; text-decoration: underline; }
  .rg-comments details { break-inside: avoid; }
  .md-spoiler-text { background: none; color: inherit; border-bottom: 1px dotted #666; }
  figure img { max-height: 8cm; }
}
`;
