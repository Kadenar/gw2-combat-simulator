/**
 * Shared profession and simulator tool navigation for simulator pages.
 *
 * The profession selector switches directly between simulator pages. Tools
 * remain single-page views driven by the URL hash and remember their scroll
 * positions when switching. `mountSimulatorNavigation` is the entry point;
 * the rest are its DOM helpers.
 */

import { resetRotationWorkspace } from '#browser/shell/rotation-workspace.js';
import { navigationRoute } from '#browser/page/embed.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { clamp } from '#kernel/core/numeric.js';

export type SimulatorView = 'workspace' | 'bosses' | 'analysis' | 'gear-optimizer' | 'benchmarks';

type ScrollPosition = Readonly<{ left: number; top: number }>;

const VIEW_HASHES: Readonly<Record<SimulatorView, string>> = {
  workspace: '#workspace',
  bosses: '#bosses',
  analysis: '#analysis',
  'gear-optimizer': '#gear-optimizer',
  benchmarks: '#benchmarks'
};

/** Maps a URL hash to a view, defaulting to `workspace` when unrecognized. */
export function simulatorViewFromHash(hash: string): SimulatorView {
  const normalized = hash.toLowerCase();

  if (normalized === VIEW_HASHES.bosses) return 'bosses';

  if (normalized === VIEW_HASHES.analysis) return 'analysis';

  if (normalized === VIEW_HASHES['gear-optimizer']) return 'gear-optimizer';

  if (normalized === VIEW_HASHES.benchmarks) return 'benchmarks';

  return 'workspace';
}

/** Gear search belongs to Golem; direct links and history cannot open it against an encounter workspace. */
export function workspaceSimulatorView(view: SimulatorView, workspace: string | undefined): SimulatorView {
  return view === 'gear-optimizer' && workspace === 'bosses' ? 'bosses' : view;
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
  heading.innerHTML = `<h2 id="analysis-view-title">Golem analysis</h2>`;
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

  // Analysis belongs to the last authoring workspace, including browser Back/Forward restoration.
  if (view === 'workspace' || view === 'bosses') root.body.dataset.analysisWorkspace = view;
  else root.body.dataset.analysisWorkspace ??= 'workspace';

  if (view !== 'workspace' && view !== 'bosses') resetRotationWorkspace(root);

  // Load cross-profession comparisons only when their tool tab is opened; the current build stays mounted.
  if (view === 'benchmarks') {
    const host = root.getElementById('benchmarks-view');

    if (host) {
      void import('#gw2/app/page/benchmark-dashboard.js')
        .then(({ mountBenchmarks }) => mountBenchmarks(host))
        .catch(() => {
          host.textContent = 'Could not load the benchmark view. Reload the page to retry.';
        });
    }
  }

  const workspace = root.body.dataset.analysisWorkspace === 'bosses' ? 'bosses' : 'workspace';
  const simulation = root.querySelector<HTMLAnchorElement>('[data-simulation-link]');

  // Simulation follows the selected workspace; the workspace selector stays selected on its tool pages.
  if (simulation) {
    simulation.dataset.simulatorView = workspace;
    simulation.href = navigationRoute(simulatorViewHref(root.defaultView?.location.pathname || '', workspace));
  }

  root
    .querySelector('.simulator-view-tabs')
    ?.setAttribute('aria-label', workspace === 'bosses' ? 'Boss tools' : 'Golem tools');
  for (const link of root.querySelectorAll<HTMLAnchorElement>('.simulator-navigation [data-simulator-view]')) {
    link.hidden = link.dataset.simulatorView === 'gear-optimizer' && root.body.dataset.analysisWorkspace === 'bosses';

    // Name the owning workspace on every navigation update, including history restoration.
    if (link.dataset.simulatorView === 'analysis')
      link.setAttribute('aria-label', workspace === 'bosses' ? 'Boss Analysis' : 'Golem Analysis');

    const active = link.classList.contains('simulator-workspace-option')
      ? link.dataset.simulatorView === (view === 'benchmarks' ? 'benchmarks' : workspace)
      : link.dataset.simulatorView === view;
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
export function mountSimulatorNavigation(): void {
  const body = document.body;
  const header = document.querySelector<HTMLElement>('#app > header');

  if (!body || !header || header.querySelector('.simulator-view-tabs')) return;

  const professionId = body.dataset.profession;

  if (!professionId) return;

  const navigation = document.createElement('nav');
  navigation.className = 'simulator-navigation';
  navigation.setAttribute('aria-label', 'Simulator sections');
  navigation.innerHTML = `<div class="simulator-header-chrome">
    <div class="simulator-header-identity"><div class="simulator-workspace-control">
      <span class="simulator-control-label">Workspace</span>
      <div class="simulator-workspace-options" role="group" aria-label="Workspace"></div>
    </div></div>
    <div class="simulator-header-global"></div>
  </div><div class="simulator-view-tabs" role="group" aria-label="Golem tools"></div>`;
  const identity = navigation.querySelector('.simulator-header-identity')!;
  const globals = navigation.querySelector('.simulator-header-global')!;
  const workspaces = navigation.querySelector('.simulator-workspace-options')!;
  const toolTabs = navigation.querySelector('.simulator-view-tabs')!;

  const pathname = document.defaultView?.location.pathname || 'index.html';
  let activeView = simulatorViewFromHash(document.defaultView?.location.hash || '');
  // Full profession portraits stay legible in the picker; native popovers handle Escape and outside-click dismissal.
  const professionControl = document.createElement('div');
  professionControl.className = 'simulator-profession-control';
  const selector = document.createElement('button');
  selector.type = 'button';
  selector.setAttribute('popovertarget', 'simulator-profession-menu');
  selector.setAttribute('aria-label', 'Choose profession');
  selector.setAttribute('aria-expanded', 'false');
  selector.textContent = professionRegistry.find(({ id }) => id === professionId)?.name || professionId;
  const professionMenu = document.createElement('div');
  professionMenu.id = 'simulator-profession-menu';
  professionMenu.className = 'simulator-profession-menu';
  professionMenu.setAttribute('popover', 'auto');
  professionMenu.setAttribute('role', 'group');
  professionMenu.setAttribute('aria-label', 'Professions');
  for (const profession of professionRegistry) {
    const option = document.createElement('a');
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
      const image = document.createElement('img');
      image.src = artwork.conceptArt;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => image.remove(), { once: true });
      option.append(image);
    }

    const name = document.createElement('span');
    name.textContent = profession.name;
    option.append(name);
    professionMenu.append(option);
  }

  // Anchor the open picker below the selector, clamped inside the viewport.
  const positionProfessionMenu = (): void => {
    const window = document.defaultView;

    if (!window || !professionMenu.matches(':popover-open')) return;

    const bounds = selector.getBoundingClientRect();
    professionMenu.style.left = `${clamp(bounds.left, 8, window.innerWidth - professionMenu.offsetWidth - 8)}px`;
    professionMenu.style.top = `${clamp(bounds.bottom + 6, 8, window.innerHeight - professionMenu.offsetHeight - 8)}px`;
  };

  professionMenu.addEventListener('beforetoggle', (event) => {
    selector.setAttribute('aria-expanded', String(event.newState === 'open'));

    if (event.newState !== 'open') return;

    // Profession changes start in Golem so normal clicks and new tabs never inherit another profession's tool or boss.
    for (const link of professionMenu.querySelectorAll<HTMLAnchorElement>('a')) {
      link.href = navigationRoute(
        simulatorViewHref(link.dataset.route!, 'workspace'),
        document.defaultView?.location.search
      );
    }

    // The menu is only measurable once open, and the async toggle event can land after the first paint, which
    // flashed the unpositioned popover at the viewport origin. An animation frame runs after the popover opens but
    // before that first paint.
    document.defaultView?.requestAnimationFrame(positionProfessionMenu);
  });
  // Keep an open picker inside the viewport when the header reflows after a resize.
  document.defaultView?.addEventListener('resize', positionProfessionMenu);
  professionControl.append(selector, professionMenu);
  identity.prepend(professionControl);
  const scrollPositions = new Map<SimulatorView, ScrollPosition>([[activeView, viewportScrollPosition(document)]]);
  // Restore twice (now + next frame) so layout that settles after the view swap
  // doesn't clobber the scroll; bail if the view changed again in between.
  const restoreScrollPosition = (view: SimulatorView, position: ScrollPosition): void => {
    const restore = (): void => {
      if (view !== activeView) return;

      document.defaultView?.scrollTo({
        left: position.left,
        top: position.top,
        behavior: 'auto'
      });
    };

    restore();
    document.defaultView?.requestAnimationFrame(restore);
  };

  // Switches to a view, saving the outgoing scroll and restoring the incoming.
  const showView = (view: SimulatorView): void => {
    const permitted = workspaceSimulatorView(view, body.dataset.analysisWorkspace);

    if (permitted !== view) {
      view = permitted;
      document.defaultView?.history.replaceState({ analysisWorkspace: 'bosses' }, '', VIEW_HASHES[view]);
    }

    if (view === activeView) {
      updateActiveView(document, view);
      return;
    }

    scrollPositions.set(activeView, viewportScrollPosition(document));
    activeView = view;
    updateActiveView(document, view);
    const position = scrollPositions.get(view) ?? { left: 0, top: 0 };
    restoreScrollPosition(view, position);
  };

  for (const view of ['workspace', 'bosses', 'analysis', 'gear-optimizer', 'benchmarks'] as const) {
    const route = simulatorViewHref(pathname, view);
    const link = createNavigationLink(
      document,
      view,
      view === 'workspace'
        ? 'Golem'
        : view === 'bosses'
          ? 'Bosses'
          : view === 'analysis'
            ? 'Analysis'
            : view === 'benchmarks'
              ? 'Benchmarks'
              : 'Gear Optimizer',
      navigationRoute(route)
    );

    // Benchmarks is a peer destination, so its selected state never implies an active simulation workspace.
    if (view === 'workspace' || view === 'bosses' || view === 'benchmarks') {
      link.className = 'simulator-workspace-option';
      workspaces.append(link);
    } else toolTabs.append(link);

    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      const window = document.defaultView;

      if (window?.location.hash !== VIEW_HASHES[view]) {
        window?.history.pushState(
          { analysisWorkspace: view === 'bosses' || view === 'workspace' ? view : body.dataset.analysisWorkspace },
          '',
          VIEW_HASHES[view]
        );
      }

      showView(view);
    });
  }

  // A dedicated Simulation tab keeps workspace selection separate from the tools within it.
  const simulationLink = createNavigationLink(
    document,
    'workspace',
    'Simulation',
    navigationRoute(simulatorViewHref(pathname, 'workspace'))
  );
  simulationLink.dataset.simulationLink = '';
  simulationLink.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const view = body.dataset.analysisWorkspace === 'bosses' ? 'bosses' : 'workspace';

    if (document.defaultView?.location.hash !== VIEW_HASHES[view])
      document.defaultView?.history.pushState({ analysisWorkspace: view }, '', VIEW_HASHES[view]);

    showView(view);
  });
  toolTabs.prepend(simulationLink);
  const community = header.querySelector('.community-actions');

  if (community) globals.append(community);

  header.prepend(navigation);
  mountAnalysisView(document);

  if (document.defaultView?.history.state?.analysisWorkspace === 'bosses') body.dataset.analysisWorkspace = 'bosses';

  showView(activeView);
  document.defaultView?.addEventListener('hashchange', () => {
    showView(simulatorViewFromHash(document.defaultView?.location.hash || ''));
  });
  document.defaultView?.addEventListener('popstate', () => {
    body.dataset.analysisWorkspace =
      document.defaultView?.history.state?.analysisWorkspace === 'bosses' ? 'bosses' : 'workspace';
    showView(simulatorViewFromHash(document.defaultView?.location.hash || ''));
  });
}
