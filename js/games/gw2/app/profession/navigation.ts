/**
 * Shared Professions / Workspace / Analysis navigation for simulator pages.
 *
 * Professions returns to the standalone landing page. Workspace and Analysis
 * remain single-page views driven by the URL hash and remember their scroll
 * positions when switching. `mountSimulatorNavigation` is the entry point;
 * the rest are its DOM helpers.
 */

import { resetRotationWorkspace } from '../../../../app/shell/workspace.js';
import { embedRoute, isEmbedded } from '../../../../app/embed.js';

export type SimulatorView = 'workspace' | 'analysis';
type SimulatorSection = 'professions' | SimulatorView;

type ScrollPosition = Readonly<{ left: number; top: number }>;

const VIEW_HASHES: Readonly<Record<SimulatorView, string>> = {
  workspace: '#workspace',
  analysis: '#analysis'
};

/** Maps a URL hash to a view, defaulting to `workspace` when unrecognized. */
export function simulatorViewFromHash(hash: string): SimulatorView {
  const normalized = hash.toLowerCase();
  if (normalized === VIEW_HASHES.analysis) return 'analysis';
  return 'workspace';
}

/** Returns the landing page for Professions and a same-page hash for simulator views. */
export function simulatorViewHref(pathname: string, view: SimulatorSection): string {
  if (view === 'professions') return 'index.html';
  const route = pathname.split('/').pop() || pathname || 'index.html';
  return `${route}${VIEW_HASHES[view]}`;
}

export const SIMULATOR_VIEW_CHANGE_EVENT = 'simulator-viewchange';

/** Creates a tab anchor, tagging it with `data-simulator-view` when a view is given. */
function createNavigationLink(root: Document, label: string, href: string, view?: SimulatorView): HTMLAnchorElement {
  const link = root.createElement('a');
  link.className = 'simulator-view-tab';
  link.href = href;
  link.textContent = label;
  if (view) link.dataset.simulatorView = view;
  return link;
}

/** Inserts the analysis-view heading and DPS-summary mirror before the results block (idempotent). */
function mountAnalysisHeading(root: Document): void {
  const results = root.getElementById('rotation-results');
  if (!results || root.getElementById('analysis-view-title')) return;

  const heading = root.createElement('div');
  heading.className = 'analysis-view-heading';
  heading.innerHTML = `<h2 id="analysis-view-title">Combat analysis</h2>`;
  results.before(heading);

  const summaryMirror = root.createElement('div');
  summaryMirror.id = 'analysis-dps-summary';
  summaryMirror.className = 'analysis-dps-summary';
  results.before(summaryMirror);

  results.setAttribute('aria-labelledby', 'analysis-view-title');
}

/** Groups the profession title into the top-left brand block. */
function mountHeaderBrand(root: Document, header: HTMLElement): void {
  if (header.querySelector('.header-brand')) return;
  const title = header.querySelector('h1');
  if (!title) return;
  const brand = root.createElement('div');
  brand.className = 'header-brand';
  title.before(brand);
  brand.append(title);
}

/**
 * Applies a view: sets `body[data-simulator-view]`, resets the rotation
 * workspace when leaving it, and marks the matching tab active/`aria-current`.
 */
function updateActiveView(root: Document, view: SimulatorView): void {
  if (!root.body) return;
  root.body.dataset.simulatorView = view;
  if (view !== 'workspace') resetRotationWorkspace(root);

  for (const link of root.querySelectorAll<HTMLAnchorElement>('.simulator-view-tab[data-simulator-view]')) {
    const active = link.dataset.simulatorView === view;
    link.classList.toggle('simulator-view-tab-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  // The app lazily materializes expensive Analysis content when this view becomes active.
  const CustomEventConstructor = root.defaultView?.CustomEvent;
  if (CustomEventConstructor) {
    root.dispatchEvent(new CustomEventConstructor(SIMULATOR_VIEW_CHANGE_EVENT, { detail: { view } }));
  }
}

/** Reads the current viewport scroll offset, falling back to the scrolling element. */
function viewportScrollPosition(root: Document): ScrollPosition {
  const view = root.defaultView;
  const scrollingElement = root.scrollingElement;
  return {
    left: view?.scrollX ?? scrollingElement?.scrollLeft ?? 0,
    top: view?.scrollY ?? scrollingElement?.scrollTop ?? 0
  };
}

/**
 * Mounts the shared Professions / Workspace / Analysis navigation into the
 * simulator header. No-op unless the header exists, a profession is set, and the
 * tabs are not already mounted. Mounts the brand block and analysis heading,
 * builds the landing-page link and two simulator tabs, and
 * wires hash/history-driven view switching with per-view scroll restoration.
 */
export function mountSimulatorNavigation(root: Document = document): void {
  const body = root.body;
  const header = root.querySelector<HTMLElement>('#app > header');
  if (!body || !header || header.querySelector('.simulator-view-tabs')) return;

  const professionId = body.dataset.profession;
  if (!professionId) return;

  const navigation = root.createElement('nav');
  navigation.className = 'simulator-view-tabs';
  navigation.setAttribute('aria-label', 'Simulator sections');

  const pathname = root.defaultView?.location.pathname || 'index.html';
  let activeView = simulatorViewFromHash(root.defaultView?.location.hash || '');
  const scrollPositions = new Map<SimulatorView, ScrollPosition>([[activeView, viewportScrollPosition(root)]]);
  // Restore twice (now + next frame) so layout that settles after the view swap
  // doesn't clobber the scroll; bail if the view changed again in between.
  const restoreScrollPosition = (view: SimulatorView, position: ScrollPosition): void => {
    const restore = (): void => {
      if (view !== activeView) return;
      root.defaultView?.scrollTo({
        left: position.left,
        top: position.top,
        behavior: 'auto'
      });
    };

    restore();
    root.defaultView?.requestAnimationFrame(restore);
  };

  // Switches to a view, saving the outgoing scroll and restoring the incoming.
  const showView = (view: SimulatorView): void => {
    if (view === activeView) {
      updateActiveView(root, view);
      return;
    }

    scrollPositions.set(activeView, viewportScrollPosition(root));
    activeView = view;
    updateActiveView(root, view);
    const position = scrollPositions.get(view) ?? { left: 0, top: 0 };
    restoreScrollPosition(view, position);
  };

  mountHeaderBrand(root, header);
  for (const section of ['professions', 'workspace', 'analysis'] as const) {
    const route = simulatorViewHref(pathname, section);
    const view = section === 'professions' ? undefined : section;
    const link = createNavigationLink(
      root,
      section === 'professions' ? 'Professions' : section === 'workspace' ? 'Workspace' : 'Analysis',
      isEmbedded() ? embedRoute(route) : route,
      view
    );
    navigation.append(link);
    if (!view) continue;
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      const window = root.defaultView;
      if (window?.location.hash !== VIEW_HASHES[view]) {
        window?.history.pushState(null, '', VIEW_HASHES[view]);
      }

      showView(view);
    });
  }

  header.prepend(navigation);
  mountAnalysisHeading(root);
  updateActiveView(root, activeView);
  root.defaultView?.addEventListener('hashchange', () => {
    showView(simulatorViewFromHash(root.defaultView?.location.hash || ''));
  });
  root.defaultView?.addEventListener('popstate', () => {
    showView(simulatorViewFromHash(root.defaultView?.location.hash || ''));
  });
}
