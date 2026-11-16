/** Inline help beside a setting shares one icon and one open and close behavior across panels. */

/** A vector icon stays crisp without relying on the font's circled-i glyph. */
export const HELP_ICON_HTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9" />
  <path d="M12 11v6" />
  <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
</svg>`;

/** Hover and keyboard focus preview the explanation. A click keeps it open until focus leaves or Escape closes it. */
export function bindHelpPopover(details: HTMLDetailsElement | null | undefined): void {
  const summary = details?.querySelector('summary');

  if (!details || !summary) return;

  let pinned = false;
  details.addEventListener('pointerenter', () => {
    details.open = true;
  });
  details.addEventListener('pointerleave', () => {
    if (!pinned && !details.contains(details.ownerDocument.activeElement)) details.open = false;
  });
  summary.addEventListener('focus', () => {
    details.open = true;
  });
  summary.addEventListener('click', (event) => {
    event.preventDefault();
    details.open = pinned = !pinned;
  });
  details.addEventListener('focusout', () => {
    details.open = pinned = false;
  });
  details.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    event.stopPropagation();
    details.open = pinned = false;
  });
}
