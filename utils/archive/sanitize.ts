/**
 * Sanitizer for Reddit's `body_html` / `selftext_html`.
 *
 * The archive-format prototype used a regex tag scanner. That is not good
 * enough here: this HTML is user-authored content and the extension has
 * privileges the prototype's `file://` artifact did not. Content scripts have
 * `DOMParser`, so we parse properly and walk an allowlist.
 *
 * Findings that drove the fixes below (measured over 1,845 real bodies):
 * Reddit emits exactly 24 distinct tags, 82 root-relative `/r/` and `/u/`
 * links, and occasionally leaks markdown escapes into both link text and the
 * href itself (`nearly%5C_every%5C_day`, which 404s on reddit.com).
 */

const ALLOWED_TAGS = new Set([
  "P", "BR", "HR",
  "EM", "I", "STRONG", "B", "DEL", "SUP", "SUB",
  "CODE", "PRE",
  "BLOCKQUOTE",
  "UL", "OL", "LI", "DL", "DT", "DD",
  "A", "IMG",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "SPAN", "DIV",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href", "title"]),
  IMG: new Set(["src", "alt", "title"]),
  TH: new Set(["align"]),
  TD: new Set(["align"]),
  SPAN: new Set(["class"]),
  DIV: new Set(["class"]),
};

/** Reddit classes worth preserving; every other class is dropped. */
const ALLOWED_CLASSES = new Set(["md", "md-spoiler-text"]);

const REDDIT_ORIGIN = "https://www.reddit.com";

/**
 * Resolve a link for an offline document. Root-relative Reddit links resolve
 * against the local filesystem from `file://` and 404, so they are absolutised.
 * Returns null for anything that is not http(s), which drops `javascript:`,
 * `data:`, and bare junk.
 */
export function resolveUrl(raw: string | null): string | null {
  if (!raw) return null;
  let url = raw.trim().replace(/[\u0000-\u0020\u007f]/g, "");
  // Reddit percent-encodes the markdown escape backslashes it failed to strip.
  if (/%5C/i.test(url)) url = url.replace(/%5C/gi, "");
  if (url.startsWith("//")) return `https:${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return REDDIT_ORIGIN + url;
  if (url.startsWith("#")) return url;
  return null;
}

/** Reddit leaks `\_` style markdown escapes into rendered link text. */
function fixTextEscapes(text: string): string {
  if (!text.includes("\\")) return text;
  return text.replace(/\\([_*~^[\]()#.>-])/g, "$1");
}

export type SanitizeResult = {
  html: string;
  /** Remote image sources found in the body, in document order. */
  imageUrls: string[];
  droppedTags: string[];
};

export type SanitizeOptions = {
  /**
   * Map of remote URL -> replacement (a data URI or a relative path). Any
   * image not in the map is replaced by a plain link, so an "offline" archive
   * never silently phones home to i.redd.it when it is opened.
   */
  mediaMap?: Map<string, string>;
};

export function sanitizeRedditHtml(
  rawHtml: string | undefined | null,
  options: SanitizeOptions = {},
): SanitizeResult {
  const imageUrls: string[] = [];
  const droppedTags: string[] = [];
  if (!rawHtml) return { html: "", imageUrls, droppedTags };

  const doc = new DOMParser().parseFromString(
    `<div id="__root">${rawHtml}</div>`,
    "text/html",
  );
  const root = doc.getElementById("__root");
  if (!root) return { html: "", imageUrls, droppedTags };

  const clean = (node: Node, out: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out.appendChild(
          doc.createTextNode(fixTextEscapes(child.textContent ?? "")),
        );
        continue;
      }
      // Comments (`<!-- SC_OFF -->`) and everything exotic are discarded.
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const el = child as Element;
      const tag = el.tagName.toUpperCase();

      if (!ALLOWED_TAGS.has(tag)) {
        droppedTags.push(tag);
        // Unwrap: keep the text, lose the element.
        clean(el, out);
        continue;
      }

      if (tag === "IMG") {
        const src = resolveUrl(el.getAttribute("src"));
        if (!src) continue;
        imageUrls.push(src);
        const alt = el.getAttribute("alt") ?? "";
        const replacement = options.mediaMap?.get(src);
        if (replacement) {
          const img = doc.createElement("img");
          img.setAttribute("src", replacement);
          if (alt) img.setAttribute("alt", alt);
          img.setAttribute("loading", "lazy");
          out.appendChild(img);
        } else {
          const link = doc.createElement("a");
          link.setAttribute("href", src);
          link.setAttribute("class", "rg-imglink");
          link.setAttribute("rel", "noopener noreferrer nofollow");
          link.textContent = alt ? `[image: ${alt}]` : "[image]";
          out.appendChild(link);
        }
        continue;
      }

      const fresh = doc.createElement(tag.toLowerCase());
      const allowedAttrs = ALLOWED_ATTRS[tag];
      if (allowedAttrs) {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (!allowedAttrs.has(name)) continue;

          if (name === "href") {
            const href = resolveUrl(attr.value);
            if (!href) continue;
            fresh.setAttribute("href", href);
            fresh.setAttribute("rel", "noopener noreferrer nofollow");
            continue;
          }
          if (name === "class") {
            const kept = attr.value
              .split(/\s+/)
              .filter((c) => ALLOWED_CLASSES.has(c));
            if (kept.length) fresh.setAttribute("class", kept.join(" "));
            continue;
          }
          fresh.setAttribute(name, attr.value);
        }
      }

      clean(el, fresh);
      out.appendChild(fresh);
    }
  };

  const container = doc.createElement("div");
  clean(root, container);

  return { html: container.innerHTML, imageUrls, droppedTags };
}

/** Collect every remote image URL in a body without building output HTML. */
export function collectImageUrls(rawHtml: string | undefined | null): string[] {
  return sanitizeRedditHtml(rawHtml).imageUrls;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
