/**
 * Embed support for hosting the simulator inside a parent page (e.g. an
 * `<iframe>` on another site).
 *
 * Three concerns:
 *  1. Iframe auto-resize — reports document height to the parent via
 *     `postMessage` so the host can size the frame to its content.
 *  2. Embed chrome — when the page is opened with `?embed=1`, a top-level
 *     `embed` class is added so standalone-site chrome (hero, footer, marketing
 *     sections) can be hidden in CSS, and internal navigation is rewritten to
 *     preserve the flag so the whole tool stays embedded as the user moves
 *     between the landing page and profession pages.
 *  3. Host viewport tracking — keeps embedded dialogs and focus mode in the
 *     visible browser area while the parent page scrolls and resizes.
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

/** Tracks the visible host area without requiring access to a cross-origin parent document. */
export function trackEmbeddedViewport(
  element: HTMLElement,
  { onVisible, preserveHeight = false }: { onVisible?: () => void; preserveHeight?: boolean } = {}
): () => void {
  const root = element.ownerDocument;
  const view = root.defaultView!;
  let frame = 0;
  let stopped = false;
  let viewportHeight = 0;
  const observer = new IntersectionObserver(([entry]) => {
    if (stopped) return;
    const rect = entry.intersectionRect;
    if (rect.width > 0 && rect.height > 0) {
      // At a frame edge, pin focus at full height and let the host clip it like a sticky panel.
      // Interior intersections reveal the host height again, including after a browser resize.
      // ponytail: clipped edges retain the last measured height; exact resize tracking there needs host viewport messages.
      if (!preserveHeight || (rect.top > 0 && rect.bottom < view.innerHeight)) viewportHeight = rect.height;
      viewportHeight = Math.min(view.innerHeight, Math.max(viewportHeight, rect.height));
      const top = Math.min(rect.top, view.innerHeight - viewportHeight);
      element.style.inset = `${top}px ${view.innerWidth - rect.right}px ${view.innerHeight - top - viewportHeight}px ${rect.left}px`;
      element.style.setProperty('--embed-viewport-height', `${viewportHeight}px`);
      element.style.setProperty('--embed-viewport-width', `${rect.width}px`);
      onVisible?.();
    }

    // Host scrolling can move the visible rectangle without changing its intersection ratio.
    observer.disconnect();
    frame = view.requestAnimationFrame(() => observer.observe(root.documentElement));
  });
  observer.observe(root.documentElement);
  return () => {
    stopped = true;
    view.cancelAnimationFrame(frame);
    observer.disconnect();
    element.style.removeProperty('inset');
    element.style.removeProperty('--embed-viewport-height');
    element.style.removeProperty('--embed-viewport-width');
  };
}

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
 * Carries active embed and standalone flags into internal links so navigation and new tabs retain the current mode.
 * Other destination query parameters and the hash are preserved; unrelated source parameters are not copied.
 */
export function navigationRoute(route: string, search = globalThis.location?.search || ''): string {
  const current = new URLSearchParams(search);
  if (!current.has(EMBED_PARAM) && current.get('standalone') !== '1') return route;
  const hashAt = route.indexOf('#');
  const path = hashAt === -1 ? route : route.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : route.slice(hashAt);
  const queryAt = path.indexOf('?');
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? '' : path.slice(queryAt + 1));
  if (current.has(EMBED_PARAM) && !params.has(EMBED_PARAM)) params.set(EMBED_PARAM, '1');
  if (current.get('standalone') === '1') params.set('standalone', '1');
  return `${pathname}?${params}${hash}`;
}

/** Rewrites static internal page links to preserve the active navigation flags. */
function decorateStaticLinks(root: Document): void {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const link of links) {
    const href = link.getAttribute('href');
    // Skip absolute/protocol-relative URLs; only decorate in-app pages.
    if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href) || !/\.html(?:[?#]|$)/.test(href)) continue;
    link.setAttribute('href', navigationRoute(href));
  }
}

/** Reports the document height to the host frame for iframe auto-resize. */
function setupResizeReporter(root: Document): void {
  let lastHeight = 0;
  const post = (): void => {
    // Preserve host scroll position during focus; its workspace follows the visible viewport inside the existing frame.
    const focusedWorkspace = root.querySelector('.embed body[data-rotation-focus] .rotation-section');
    const height = focusedWorkspace && lastHeight ? lastHeight : root.documentElement.scrollHeight;
    lastHeight = height;
    globalThis.parent?.postMessage({ type: EMBED_HEIGHT_MESSAGE, height, url: globalThis.location?.href }, HOST_ORIGIN);
  };

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(post).observe(root.documentElement);
  }

  // A fixed workspace can change focus without resizing the document underneath it.
  if (root.body && typeof MutationObserver !== 'undefined') {
    new MutationObserver(post).observe(root.body, { attributes: true, attributeFilter: ['data-rotation-focus'] });
  }

  globalThis.addEventListener?.('load', post);
  post();
}

/**
 * Initializes embed behavior for a document.
 *
 * The resize reporter runs whenever the page is framed (independent of the
 * embed flag) so a host can always size the frame. Chrome hiding requires the
 * embed flag; internal links preserve both embed and standalone flags.
 */
export function initEmbed(root: Document = document): void {
  if (isFramed()) setupResizeReporter(root);
  if (isEmbedded()) root.documentElement.classList.add('embed');
  decorateStaticLinks(root);
}

if (typeof document !== 'undefined') {
  initEmbed(document);
}
