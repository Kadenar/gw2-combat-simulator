/**
 * Shared profession and simulator tool navigation for simulator pages.
 *
 * The profession selector switches directly between simulator pages. Tools
 * remain single-page views driven by the URL hash and remember their scroll
 * positions when switching. `mountSimulatorNavigation` is the entry point;
 * the rest are its DOM helpers.
 */

import { resetRotationWorkspace } from '#app/shell/rotation-workspace.js';
import { navigationRoute } from '#app/page/embed.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { clamp } from '#kernel/core/numeric.js';

export type SimulatorView = 'workspace' | 'analysis' | 'gear-optimizer';

type ScrollPosition = Readonly<{ left: number; top: number }>;

const VIEW_HASHES: Readonly<Record<SimulatorView, string>> = {
  workspace: '#workspace',
  analysis: '#analysis',
  'gear-optimizer': '#gear-optimizer'
};

/** Maps a URL hash to a view, defaulting to `workspace` when unrecognized. */
export function simulatorViewFromHash(hash: string): SimulatorView {
  const normalized = hash.toLowerCase();
  if (normalized === VIEW_HASHES.analysis) return 'analysis';
  if (normalized === VIEW_HASHES['gear-optimizer']) return 'gear-optimizer';
  return 'workspace';
}

/** Keeps simulator tools on the given profession page. */
export function simulatorViewHref(pathname: string, view: SimulatorView): string {
  const route = pathname.split('/').pop() || pathname || 'index.html';
  return `${route}${VIEW_HASHES[view]}`;
}

export const SIMULATOR_VIEW_CHANGE_EVENT = 'simulator-viewchange';

/** Creates a tool link that supports normal browser navigation as well as in-page switching. */
function createNavigationLink(root: Document, view: SimulatorView, label: string, href: string): HTMLAnchorElement {
  const link = root.createElement('a');
  link.className = 'simulator-view-tab';
  link.href = href;
  link.textContent = label;
  link.dataset.simulatorView = view;
  return link;
}

/** Labels the Analysis results host without controlling other tool views. */
function mountAnalysisView(root: Document): void {
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
  const EventConstructor = root.defaultView?.Event;
  if (EventConstructor) {
    root.dispatchEvent(new EventConstructor(SIMULATOR_VIEW_CHANGE_EVENT));
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
 * Mounts the profession selector and simulator tool tabs into the
 * simulator header. No-op unless the header exists, a profession is set, and the
 * tabs are not already mounted. Mounts the analysis heading,
 * builds direct profession navigation and simulator tabs, and
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
  // Full profession portraits stay legible in the picker; native popovers handle Escape and outside-click dismissal.
  const professionControl = root.createElement('div');
  professionControl.className = 'simulator-profession-control';
  const selector = root.createElement('button');
  selector.type = 'button';
  selector.setAttribute('popovertarget', 'simulator-profession-menu');
  selector.setAttribute('aria-label', 'Choose profession');
  selector.setAttribute('aria-expanded', 'false');
  selector.textContent = professionRegistry.find(({ id }) => id === professionId)?.name || professionId;
  const professionMenu = root.createElement('div');
  professionMenu.id = 'simulator-profession-menu';
  professionMenu.className = 'simulator-profession-menu';
  professionMenu.setAttribute('popover', 'auto');
  professionMenu.setAttribute('role', 'group');
  professionMenu.setAttribute('aria-label', 'Professions');
  for (const profession of professionRegistry) {
    const option = root.createElement('a');
    option.className = `simulator-profession-option profession-card-${profession.id}`;
    option.dataset.route = profession.route;
    if (profession.id === professionId) {
      option.setAttribute('aria-current', 'page');
      option.setAttribute('autofocus', '');
    }

    // Vary each profession's portrait per page visit, using only full portraits that fit the compact cards.
    const portraits = profession.specializationArtwork?.filter(({ conceptArt }) => conceptArt);
    const artwork = portraits?.length ? portraits[Math.floor(Math.random() * portraits.length)] : undefined;
    if (artwork?.conceptArt) {
      const image = root.createElement('img');
      image.src = artwork.conceptArt;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => image.remove(), { once: true });
      option.append(image);
    }

    const name = root.createElement('span');
    name.textContent = profession.name;
    option.append(name);
    professionMenu.append(option);
  }

  professionMenu.addEventListener('beforetoggle', (event) => {
    selector.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState !== 'open') return;
    // Refresh destinations on every opening so normal clicks and new tabs retain the current tool and mode.
    for (const link of professionMenu.querySelectorAll<HTMLAnchorElement>('a')) {
      link.href = navigationRoute(
        simulatorViewHref(link.dataset.route!, activeView),
        root.defaultView?.location.search
      );
    }
  });
  // Keep an open picker inside the viewport when the header reflows after a resize.
  const positionProfessionMenu = (): void => {
    const window = root.defaultView;
    if (!window || !professionMenu.matches(':popover-open')) return;
    const bounds = selector.getBoundingClientRect();
    professionMenu.style.left = `${clamp(bounds.left, 8, window.innerWidth - professionMenu.offsetWidth - 8)}px`;
    professionMenu.style.top = `${clamp(bounds.bottom + 6, 8, window.innerHeight - professionMenu.offsetHeight - 8)}px`;
  };

  professionMenu.addEventListener('toggle', positionProfessionMenu);
  root.defaultView?.addEventListener('resize', positionProfessionMenu);
  professionControl.append(selector, professionMenu);
  navigation.append(professionControl);
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

  for (const view of ['workspace', 'analysis', 'gear-optimizer'] as const) {
    const route = simulatorViewHref(pathname, view);
    const link = createNavigationLink(
      root,
      view,
      view === 'workspace' ? 'Workspace' : view === 'analysis' ? 'Analysis' : 'Gear Optimizer',
      navigationRoute(route)
    );
    navigation.append(link);
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
  mountAnalysisView(root);
  updateActiveView(root, activeView);
  root.defaultView?.addEventListener('hashchange', () => {
    showView(simulatorViewFromHash(root.defaultView?.location.hash || ''));
  });
  root.defaultView?.addEventListener('popstate', () => {
    showView(simulatorViewFromHash(root.defaultView?.location.hash || ''));
  });
}
