import { useEffect, useRef, useState } from "react";
import { MediaContentType } from "@/types";
import DownloadButton from "@/components/download-button";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { cn } from "@/utils/cn";
import { archivePost } from "@/utils/archive/archive-post";
import { getPostIdentifier } from "@/utils/post-identifier";

type ArchiveState = "idle" | "working" | "done" | "error";

/**
 * The per-post control cluster: the media Download button plus a caret that
 * opens the secondary actions. Archive lives behind the caret because it is the
 * rarer action and the primary click must stay "download the media".
 *
 * The menu is hand-rolled rather than Radix: this renders inside a WXT shadow
 * root, and Radix portals its content to `document.body`, which would escape
 * the shadow root and lose every style with it.
 */
const PostActions = ({
  postElement,
  mediaContainer,
  mediaContentType,
}: {
  postElement: Element;
  mediaContainer: Element | null;
  mediaContentType: MediaContentType | null;
}) => {
  const [open, setOpen] = useState(false);
  const [archiveState, setArchiveState] = useState<ArchiveState>("idle");
  const [detail, setDetail] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape. Inside a shadow root, `composedPath` is
  // the only reliable way to tell whether the click was ours.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: Event) => {
      const path = event.composedPath();
      if (rootRef.current && !path.includes(rootRef.current)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const handleArchive = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (archiveState === "working") return;

    setOpen(false);
    setArchiveState("working");
    setDetail("");

    try {
      const stats = await archivePost({
        postId: getPostIdentifier(postElement),
        postElement,
      });

      setArchiveState("done");
      // Report comments actually written. Reddit's `num_comments` counts
      // deleted and removed comments it never serves, so it is not the truth.
      setDetail(
        stats.moreStubs > 0
          ? `${stats.servedComments} comments, ${stats.moreStubs} threads capped`
          : `${stats.servedComments} comments`,
      );
      setTimeout(() => setArchiveState("idle"), 4000);
    } catch (error) {
      // Not `logger.error`: that compiles to a no-op in production builds,
      // which left failures with no visible reason anywhere.
      console.error("[RedditGrab] Archive failed:", error);
      setArchiveState("error");
      setDetail((error as Error)?.message ?? String(error));
      setTimeout(() => setArchiveState("idle"), 8000);
    }
  };

  const status =
    archiveState === "working"
      ? "Archiving..."
      : archiveState === "done"
        ? `Saved · ${detail}`
        : archiveState === "error"
          ? `Archive failed: ${detail.slice(0, 60)}`
          : "";

  return (
    <div
      ref={rootRef}
      // `mr-2` keeps the caret clear of the post card's right edge, which
      // clipped it once the cluster grew wider than the lone Download button.
      className="relative mr-2 flex flex-col items-end gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        {mediaContainer && mediaContentType && (
          <DownloadButton
            mediaContainer={mediaContainer}
            mediaContentType={mediaContentType}
          />
        )}
        <Button
          size="sm"
          variant="secondary"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More post actions"
          title="More post actions"
          disabled={archiveState === "working"}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            setOpen((value) => !value);
          }}
          className={cn(
            "mt-1 rounded-4xl cursor-pointer text-xs",
            // Without a Download button beside it a bare caret reads as noise,
            // so it gets a label of its own.
            mediaContainer ? "px-2" : "px-3",
          )}
        >
          {!mediaContainer && <span>Archive</span>}
          <Icon
            icon="lucide:chevron-down"
            className={cn("size-3 transition-transform", open && "rotate-180")}
          />
        </Button>
      </div>

      {open && (
        <div
          role="menu"
          // Opens upward: this cluster sits at the bottom edge of the post
          // card, so a downward menu is clipped by the card and lands off
          // screen at the end of a feed.
          className="absolute bottom-full right-0 z-50 mb-1 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleArchive}
            className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-xs text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <Icon icon="lucide:archive" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="block font-medium">Archive post</span>
              <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">
                Text, media and comments as one HTML file
              </span>
            </span>
          </button>
        </div>
      )}

      {status && (
        <span
          title={archiveState === "error" ? detail : undefined}
          className={cn(
            "max-w-[220px] truncate text-[10px]",
            archiveState === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-neutral-500 dark:text-neutral-400",
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
};

export default PostActions;
