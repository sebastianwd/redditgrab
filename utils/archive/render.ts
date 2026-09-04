/**
 * Renders an ArchivePost into one self-contained HTML document.
 *
 * Constraints carried over from the format prototype:
 * - Comments are nested `<details open>`: they collapse with JavaScript
 *   disabled and print expanded.
 * - No script, no fetch, no external stylesheet. The file is the artifact.
 * - Any media not inlined becomes a link, never a live `<img src>` pointing at
 *   Reddit, so opening the archive does not tell Reddit you opened it.
 */

import { ARCHIVE_CSS } from "./styles";
import { escapeHtml, sanitizeRedditHtml } from "./sanitize";
import type { ArchiveComment, ArchivePost } from "./tree";

export type RenderOptions = {
  /** Remote URL -> data URI for media that was successfully inlined. */
  mediaMap: Map<string, string>;
  archivedAt: string;
  /** Set when the media budget stopped us from inlining everything. */
  mediaNote?: string;
};

const fmtDate = (utc: number): string =>
  utc ? `${new Date(utc * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC` : "";

const fmtScore = (n: number | null): string =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-US");

const userLink = (author: string): string =>
  `<a class="rg-author" href="https://www.reddit.com/user/${encodeURIComponent(
    author,
  )}" rel="noopener noreferrer nofollow">u/${escapeHtml(author)}</a>`;

function commentBadges(c: ArchiveComment): string {
  const out: string[] = [];
  if (c.isSubmitter) out.push('<span class="rg-badge rg-op">OP</span>');
  if (c.distinguished === "moderator")
    out.push('<span class="rg-badge rg-mod">MOD</span>');
  if (c.distinguished === "admin")
    out.push('<span class="rg-badge rg-admin">ADMIN</span>');
  if (c.stickied) out.push('<span class="rg-badge">pinned</span>');
  if (c.edited) out.push('<span class="rg-badge">edited</span>');
  return out.join("");
}

function renderComment(c: ArchiveComment, options: RenderOptions): string {
  const gone = c.deleted || c.removed;
  const author = c.deleted
    ? '<span class="rg-gone-label">[deleted]</span>'
    : userLink(c.author);

  // Deleted and removed content is shown plainly, never hidden: an archive that
  // silently drops removed comments misrepresents the thread.
  const body = c.removed
    ? '<p class="rg-gone-label">[removed by moderators]</p>'
    : c.deleted
      ? '<p class="rg-gone-label">[deleted by user]</p>'
      : sanitizeRedditHtml(c.bodyHtml, { mediaMap: options.mediaMap }).html;

  const replies = c.replies.map((r) => renderComment(r, options)).join("");

  return `<details open class="${gone ? "rg-gone" : ""}" id="c_${escapeHtml(c.id)}">
<summary>${author} <span class="rg-sep">·</span> ${fmtScore(c.score)} pts <span class="rg-sep">·</span> <time>${fmtDate(c.createdUtc)}</time> ${commentBadges(c)}</summary>
<div class="rg-cbody" dir="auto">${body}</div>
${replies ? `<div class="rg-replies">${replies}</div>` : ""}
</details>`;
}

function renderMedia(post: ArchivePost, options: RenderOptions): string {
  const media = post.media;

  if (media.type === "link" && media.link) {
    return `<p class="rg-links">Links out: <a href="${escapeHtml(media.link)}" rel="noopener noreferrer nofollow">${escapeHtml(media.link)}</a></p>`;
  }
  if (!media.items.length) return "";

  const figures = media.items
    .map((item) => {
      const inlined = options.mediaMap.get(item.url);
      const caption = `<figcaption>${
        item.caption ? `${escapeHtml(item.caption)} · ` : ""
      }<a href="${escapeHtml(item.url)}" rel="noopener noreferrer nofollow">original</a></figcaption>`;

      if (!inlined) {
        const label =
          item.kind === "video"
            ? `video${item.durationSeconds ? ` · ${item.durationSeconds}s` : ""} not embedded`
            : "image not embedded";
        return `<figure><div class="rg-placeholder">${label}</div>${caption}</figure>`;
      }
      if (item.kind === "video") {
        return `<figure><video controls preload="metadata" src="${inlined}"></video>${caption}</figure>`;
      }
      return `<figure><img src="${inlined}" alt="${escapeHtml(item.caption || post.title)}" loading="lazy">${caption}</figure>`;
    })
    .join("\n");

  return `<div class="rg-media${media.type === "gallery" ? " rg-gallery" : ""}">${figures}</div>`;
}

export function renderArchiveDocument(
  post: ArchivePost,
  options: RenderOptions,
): string {
  const selftext = sanitizeRedditHtml(post.selftextHtml, {
    mediaMap: options.mediaMap,
  }).html;

  const comments = post.comments.map((c) => renderComment(c, options)).join("\n");

  // The only honest completeness signal is whether `more` stubs remain.
  // `num_comments` is wrong in both directions and is never rendered.
  const truncation =
    post.moreStubs > 0
      ? `<p class="rg-note">${post.moreStubs.toLocaleString("en-US")} comment thread${
          post.moreStubs === 1 ? "" : "s"
        } not included (Reddit serves at most 500 comments per request).</p>`
      : "";

  const mediaNote = options.mediaNote
    ? `<p class="rg-note">${escapeHtml(options.mediaNote)}</p>`
    : "";

  const flags = [
    post.over18 ? '<span class="rg-badge rg-nsfw">NSFW</span>' : "",
    post.spoiler ? '<span class="rg-badge">spoiler</span>' : "",
    post.locked ? '<span class="rg-badge">locked</span>' : "",
    post.stickied ? '<span class="rg-badge">pinned</span>' : "",
    post.flair ? `<span class="rg-flair">${escapeHtml(post.flair)}</span>` : "",
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(post.title)} - r/${escapeHtml(post.subreddit)}</title>
<meta name="generator" content="RedditGrab">
<meta name="archived-at" content="${escapeHtml(options.archivedAt)}">
<style>${ARCHIVE_CSS}</style>
</head>
<body>
<main class="rg-archive">
<article>
<h1 dir="auto">${escapeHtml(post.title)}</h1>
<p class="rg-meta">
${userLink(post.author)}
<span class="rg-sep">·</span> <a href="https://www.reddit.com/r/${encodeURIComponent(post.subreddit)}/" rel="noopener noreferrer nofollow">r/${escapeHtml(post.subreddit)}</a>
<span class="rg-sep">·</span> ${fmtScore(post.score)} pts${
    post.upvoteRatio ? ` (${Math.round(post.upvoteRatio * 100)}% upvoted)` : ""
  }
<span class="rg-sep">·</span> <time>${fmtDate(post.createdUtc)}</time>
${flags}
</p>
<p class="rg-links"><a href="${escapeHtml(post.permalink)}" rel="noopener noreferrer nofollow">View on reddit.com</a> <span class="rg-sep">·</span> archived ${escapeHtml(options.archivedAt)}</p>
${renderMedia(post, options)}
${selftext ? `<div class="rg-selftext" dir="auto">${selftext}</div>` : ""}
</article>
<section class="rg-comments">
<h2>${post.served.toLocaleString("en-US")} comments archived</h2>
${comments || '<p class="rg-note">No comments were served for this post.</p>'}
${truncation}
${mediaNote}
</section>
</main>
</body>
</html>
`;
}
