/** Resolves simulator routes and active views without importing page mounting or worker launchers. */
export type SimulatorView = 'workspace' | 'bosses' | 'analysis' | 'gear-optimizer' | 'benchmarks' | 'modifiers';

export const VIEW_HASHES: Readonly<Record<SimulatorView, string>> = {
  workspace: '#workspace',
  bosses: '#bosses',
  analysis: '#analysis',
  'gear-optimizer': '#gear-optimizer',
  benchmarks: '#benchmarks',
  modifiers: '#modifiers'
};

/** Maps a URL hash to a view, defaulting to `workspace` when unrecognized. */
export function simulatorViewFromHash(hash: string): SimulatorView {
  const normalized = hash.toLowerCase();

  if (normalized === VIEW_HASHES.bosses) return 'bosses';

  if (normalized === VIEW_HASHES.analysis) return 'analysis';

  if (normalized === VIEW_HASHES['gear-optimizer']) return 'gear-optimizer';

  if (normalized === VIEW_HASHES.benchmarks) return 'benchmarks';

  if (normalized === VIEW_HASHES.modifiers) return 'modifiers';

  return 'workspace';
}

/** Uses the mounted view or the shared hash parser so analysis scheduling and rendering agree during startup. */
export function analysisViewIsActive(): boolean {
  if (typeof document === 'undefined') return true;

  const body = document.body;

  if (!body) return true;

  const mountedView = body.dataset.simulatorView;

  if (mountedView) return mountedView === 'analysis';

  return simulatorViewFromHash(document.defaultView?.location.hash || '') === 'analysis';
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
