/**
 * Normalise Reddit's `/comments/<id>/.json` payload into a small typed shape.
 *
 * Reddit already nests replies, so the tree is a recursion over `replies`
 * rather than a `parent_id` join. `depth` is present at the top level but not
 * always on nested payloads, so our own recursion depth is the fallback.
 */

export type ArchiveComment = {
  id: string;
  author: string;
  depth: number;
  bodyHtml: string;
  score: number | null;
  createdUtc: number;
  edited: boolean | number;
  isSubmitter: boolean;
  distinguished: string | null;
  stickied: boolean;
  deleted: boolean;
  removed: boolean;
  replies: ArchiveComment[];
};

export type ArchiveMediaItem = {
  kind: "image" | "gif" | "video";
  url: string;
  caption?: string;
  durationSeconds?: number;
};

export type ArchiveMedia = {
  type: "image" | "gallery" | "video" | "link" | "text";
  items: ArchiveMediaItem[];
  link: string | null;
};

export type ArchivePost = {
  id: string;
  subreddit: string;
  title: string;
  author: string;
  permalink: string;
  createdUtc: number;
  score: number;
  upvoteRatio: number;
  /**
   * What Reddit claims. Measured to be wrong in both directions (274 claimed /
   * 19 served, 135 claimed / 139 served), so it is never rendered.
   */
  numCommentsClaimed: number;
  flair: string;
  over18: boolean;
  spoiler: boolean;
  locked: boolean;
  stickied: boolean;
  selftextHtml: string;
  media: ArchiveMedia;
  comments: ArchiveComment[];
  /** Comments actually rendered. */
  served: number;
  /** `more` stubs left behind: the only honest completeness signal. */
  moreStubs: number;
  /** Comments Reddit says are behind those stubs. */
  hiddenCount: number;
};

type Listing = { data?: { children?: RawChild[] } };
type RawChild = { kind: string; data: any };

export function parsePostJson(raw: [Listing, Listing]): ArchivePost {
  const post = raw?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error("Unexpected post JSON shape");

  const { comments, moreStubs, hiddenCount, served } = parseComments(raw?.[1]);

  return {
    id: post.id,
    subreddit: post.subreddit ?? "unknown",
    title: post.title ?? "",
    author: post.author ?? "[deleted]",
    permalink: post.permalink
      ? `https://www.reddit.com${post.permalink}`
      : `https://www.reddit.com/comments/${post.id}/`,
    createdUtc: post.created_utc ?? 0,
    score: post.score ?? 0,
    upvoteRatio: post.upvote_ratio ?? 0,
    numCommentsClaimed: post.num_comments ?? 0,
    flair: post.link_flair_text || "",
    over18: !!post.over_18,
    spoiler: !!post.spoiler,
    locked: !!post.locked,
    stickied: !!post.stickied,
    selftextHtml: post.selftext_html || "",
    media: extractMedia(post),
    comments,
    served,
    moreStubs,
    hiddenCount,
  };
}

function parseComments(listing: Listing | undefined) {
  let moreStubs = 0;
  let hiddenCount = 0;
  let served = 0;

  const walk = (l: Listing | undefined, depth: number): ArchiveComment[] => {
    const out: ArchiveComment[] = [];
    for (const child of l?.data?.children ?? []) {
      if (child.kind === "more") {
        moreStubs++;
        hiddenCount += child.data?.count ?? 0;
        continue;
      }
      const d = child.data;
      if (!d) continue;
      served++;
      out.push({
        id: d.id,
        author: d.author ?? "[deleted]",
        depth: typeof d.depth === "number" ? d.depth : depth,
        bodyHtml: d.body_html || "",
        score: typeof d.score === "number" && !d.score_hidden ? d.score : null,
        createdUtc: d.created_utc ?? 0,
        edited: d.edited ?? false,
        isSubmitter: !!d.is_submitter,
        distinguished: d.distinguished ?? null,
        stickied: !!d.stickied,
        deleted: d.author === "[deleted]" && d.body === "[deleted]",
        removed: d.body === "[removed]",
        replies: d.replies ? walk(d.replies, depth + 1) : [],
      });
    }
    return out;
  };

  return { comments: walk(listing, 0), moreStubs, hiddenCount, served };
}

function extractMedia(post: any): ArchiveMedia {
  const items: ArchiveMediaItem[] = [];

  if (post.is_gallery && post.gallery_data?.items && post.media_metadata) {
    for (const item of post.gallery_data.items) {
      const meta = post.media_metadata[item.media_id];
      if (!meta) continue;
      const src: string | undefined = meta.s?.u || meta.s?.gif || meta.s?.mp4;
      if (!src) continue;
      items.push({
        kind: meta.e === "AnimatedImage" ? "gif" : "image",
        url: src.replace(/&amp;/g, "&"),
        caption: item.caption || "",
      });
    }
    return { type: "gallery", items, link: null };
  }

  const redditVideo = (post.secure_media ?? post.media)?.reddit_video;
  if (post.is_video && redditVideo?.fallback_url) {
    items.push({
      kind: "video",
      url: redditVideo.fallback_url,
      durationSeconds: redditVideo.duration,
    });
    return { type: "video", items, link: null };
  }

  if (
    post.post_hint === "image" ||
    post.domain === "i.redd.it" ||
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(post.url ?? "")
  ) {
    if (post.url) {
      items.push({ kind: "image", url: post.url });
      return { type: "image", items, link: null };
    }
  }

  if (post.is_self || post.post_hint === "self") {
    return { type: "text", items, link: null };
  }

  if (post.url && !String(post.url).includes("reddit.com/r/")) {
    return { type: "link", items, link: post.url };
  }

  return { type: "text", items, link: null };
}

/** Depth-first flatten. Used for media collection and counting. */
export function flattenComments(comments: ArchiveComment[]): ArchiveComment[] {
  const out: ArchiveComment[] = [];
  const walk = (list: ArchiveComment[]) => {
    for (const c of list) {
      out.push(c);
      walk(c.replies);
    }
  };
  walk(comments);
  return out;
}
