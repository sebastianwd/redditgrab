/**
 * Hand-written download glyph, inlined rather than pulled through
 * `@iconify/react` so the button paints instantly and needs nothing at runtime.
 *
 * Sized in `em` so it follows the button's font size, and painted with
 * `currentColor` so it inherits the button variant's text colour.
 */
const DownloadIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M0 0h24v24H0z" fill="none" />
    <path
      fill="currentColor"
      d="m12 16l-5-5l1.4-1.45l2.6 2.6V4h2v8.15l2.6-2.6L17 11zm-6 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"
    />
  </svg>
);

export default DownloadIcon;
