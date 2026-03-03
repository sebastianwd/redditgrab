const REMOVE_IFRAME_TIMEOUT = 3000;

/**
 * Mark the post as visited by loading its permalink in a hidden iframe.
 * This triggers a real request so the browser (and Reddit) can record the visit.
 */
export function markPostAsVisited(postElement: Element): boolean {
  const link = postElement.querySelector(
    'a[href*="/comments/"]',
  ) as HTMLAnchorElement | null;
  if (!link?.href) return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("hidden", "true");
  iframe.style.cssText =
    "position:absolute;width:0;height:0;border:0;visibility:hidden;";
  iframe.src = link.href;

  const remove = () => {
    try {
      iframe.remove();
    } catch {}
  };

  iframe.addEventListener("load", remove, { once: true });
  setTimeout(remove, REMOVE_IFRAME_TIMEOUT);

  document.body.appendChild(iframe);
  return true;
}
