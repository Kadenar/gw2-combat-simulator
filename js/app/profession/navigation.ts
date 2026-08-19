import { resetRotationWorkspace } from '../../platform/ui/rotation-workspace.js';
import { embedRoute, isEmbedded } from '../embed.js';

export type SimulatorView = 'professions' | 'workspace' | 'analysis';

type ScrollPosition = Readonly<{ left: number; top: number }>;

const VIEW_HASHES: Readonly<Record<SimulatorView, string>> = {
  professions: '#professions',
  workspace: '#workspace',
  analysis: '#analysis'
};

export function simulatorViewFromHash(hash: string): SimulatorView {
  const normalized = hash.toLowerCase();
  if (normalized === VIEW_HASHES.professions) return 'professions';
  if (normalized === VIEW_HASHES.analysis) return 'analysis';
  return 'workspace';
}

export function simulatorViewHref(pathname: string, view: SimulatorView): string {
  const route = pathname.split('/').pop() || pathname || 'index.html';
  return `${route}${VIEW_HASHES[view]}`;
}

function createNavigationLink(root: Document, label: string, href: string, view?: SimulatorView): HTMLAnchorElement {
  const link = root.createElement('a');
  link.className = 'simulator-view-tab';
  link.href = href;
  link.textContent = label;
  if (view) link.dataset.simulatorView = view;
  return link;
}

function mountAnalysisHeading(root: Document): void {
  const results = root.getElementById('rotation-results');
  if (!results || root.getElementById('analysis-view-title')) return;

  const heading = root.createElement('div');
  heading.className = 'analysis-view-heading';
  heading.innerHTML = `
    <p>Simulation output</p>
    <h2 id="analysis-view-title">Combat analysis</h2>
    <span>Damage breakdown, DPS over time, and modifier contributions for the current workspace.</span>
  `;
  results.before(heading);

  const summaryMirror = root.createElement('div');
  summaryMirror.id = 'analysis-dps-summary';
  summaryMirror.className = 'analysis-dps-summary';
  results.before(summaryMirror);

  results.setAttribute('aria-labelledby', 'analysis-view-title');
}

/** Groups the title and API-snapshot pill into a top-left brand block. */
function mountHeaderBrand(root: Document, header: HTMLElement): void {
  if (header.querySelector('.header-brand')) return;
  const title = header.querySelector('h1');
  if (!title) return;
  const brand = root.createElement('div');
  brand.className = 'header-brand';
  title.before(brand);
  brand.append(title);
  const snapshot = header.nextElementSibling?.classList.contains('update-info')
    ? header.nextElementSibling
    : header.querySelector(':scope > .update-info');
  if (snapshot) brand.append(snapshot);
}

function mountProfessionBrowser(root: Document, header: HTMLElement): void {
  if (root.querySelector('.profession-browser-view')) return;

  const section = root.createElement('section');
  section.className = 'profession-browser-view';
  section.setAttribute('aria-labelledby', 'profession-browser-title');
  section.innerHTML = `
    <div class="profession-browser-heading">
      <p class="landing-eyebrow">Profession simulators</p>
      <h2 id="profession-browser-title">Choose a profession</h2>
    </div>
    <div class="profession-grid" data-profession-grid></div>
  `;

  const snapshot = header.nextElementSibling;
  if (snapshot?.classList.contains('update-info')) snapshot.after(section);
  else header.after(section);
}

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
}

function viewportScrollPosition(root: Document): ScrollPosition {
  const view = root.defaultView;
  const scrollingElement = root.scrollingElement;
  return {
    left: view?.scrollX ?? scrollingElement?.scrollLeft ?? 0,
    top: view?.scrollY ?? scrollingElement?.scrollTop ?? 0
  };
}

/** Mounts the shared Professions / Workspace / Analysis navigation. */
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

  header.querySelector('.profession-picker')?.remove();
  mountHeaderBrand(root, header);
  mountProfessionBrowser(root, header);
  for (const view of ['professions', 'workspace', 'analysis'] as const) {
    const route = simulatorViewHref(pathname, view);
    const link = createNavigationLink(
      root,
      view === 'professions' ? 'Professions' : view === 'workspace' ? 'Workspace' : 'Analysis',
      isEmbedded() ? embedRoute(route) : route,
      view
    );
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
    navigation.append(link);
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
