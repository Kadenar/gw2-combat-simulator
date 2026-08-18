/**
 * Embed support for hosting the simulator inside a parent page (e.g. an
 * `<iframe>` on another site).
 *
 * Two concerns:
 *  1. Iframe auto-resize — reports document height to the parent via
 *     `postMessage` so the host can size the frame to its content.
 *  2. Embed chrome — when the page is opened with `?embed=1`, a top-level
 *     `embed` class is added so standalone-site chrome (hero, footer, marketing
 *     sections) can be hidden in CSS, and internal navigation is rewritten to
 *     preserve the flag so the whole tool stays embedded as the user moves
 *     between the landing page and profession pages.
 *
 * Importing this module in a browser initializes both automatically. Importing
 * it outside a browser has no side effect.
 */

const EMBED_PARAM = 'embed';

/** Message type emitted to the host frame for auto-resize. */
export const EMBED_HEIGHT_MESSAGE = 'gw2sim:height';

/**
 * Target origin for `postMessage`. `*` works for any host; tighten to the
 * embedding site's origin (e.g. `https://snowcrows.com`) to harden against
 * other frames reading the height signal.
 */
const HOST_ORIGIN = '*';

/** True when the current page was opened in embed mode (`?embed` / `?embed=1`). */
export function isEmbedded(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search || '').has(EMBED_PARAM);
  } catch {
    return false;
  }
}

/** True when the document is rendered inside a frame (any origin). */
function isFramed(): boolean {
  try {
    return globalThis.self !== globalThis.top;
  } catch {
    // Cross-origin access to `top` throws — which only happens when framed.
    return true;
  }
}

/**
 * Returns `route` with the embed flag applied so navigation stays embedded.
 * Idempotent, and preserves an existing query string and hash.
 */
export function embedRoute(route: string): string {
  if (/[?&]embed(=|&|$)/.test(route)) return route;
  const hashAt = route.indexOf('#');
  const path = hashAt === -1 ? route : route.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : route.slice(hashAt);
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${EMBED_PARAM}=1${hash}`;
}

/** Rewrites same-document relative links to carry the embed flag. */
function decorateStaticLinks(root: Document): void {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href$=".html"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    // Skip absolute/protocol-relative URLs; only decorate in-app pages.
    if (!href || /^([a-z]+:)?\/\//i.test(href)) continue;
    link.setAttribute('href', embedRoute(href));
  }
}

/** Reports the document height to the host frame for iframe auto-resize. */
function setupResizeReporter(root: Document): void {
  const post = (): void => {
    const height = root.documentElement.scrollHeight;
    globalThis.parent?.postMessage({ type: EMBED_HEIGHT_MESSAGE, height, url: globalThis.location?.href }, HOST_ORIGIN);
  };
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(post).observe(root.documentElement);
  }
  globalThis.addEventListener?.('load', post);
  post();
}

/**
 * Initializes embed behavior for a document.
 *
 * The resize reporter runs whenever the page is framed (independent of the
 * embed flag) so a host can always size the frame. Chrome hiding and link
 * decoration only apply when the embed flag is present.
 */
export function initEmbed(root: Document = document): void {
  if (isFramed()) setupResizeReporter(root);
  if (!isEmbedded()) return;
  root.documentElement.classList.add('embed');
  decorateStaticLinks(root);
}

if (typeof document !== 'undefined') {
  initEmbed(document);
}
