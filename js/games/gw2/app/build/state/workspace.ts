import { createDefaultBuild, loadBuild, replaceBuild } from '#gw2/app/build/state/persistence.js';
import type { Gw2AppAdapter, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';

/** Only build-specific editing state travels with a tab; display preferences remain shared. */
export function emptyBuildTabSession() {
  return {
    results: null,
    patchComparison: null,
    attributeData: null,
    attributeWeaponSet: 1,
    rotationComparison: null,
    rotationInsertionIndex: null,
    currentTemplate: null,
    templateUndoBuild: null,
    templateUndoMessage: '',
    _rotationHistory: undefined,
    procVisibility: undefined,
    procVisibilityKeys: undefined,
    procFilterOpen: false,
    procHighlightKey: null,
    rotationSkillHighlightKey: null,
    _skillBreakdownState: undefined,
    _skillSortCol: null,
    _skillSortDir: null
  } satisfies Partial<ProfessionAppState>;
}

type BuildTabSession = Pick<ProfessionAppState, keyof ReturnType<typeof emptyBuildTabSession>>;

export interface BuildTab {
  id: string;
  name: string;
  build: Gw2ApplicationBuild;
  patchId: string;
  session: BuildTabSession;
  resultsFresh: boolean;
}

export interface BuildWorkspace {
  tabs: BuildTab[];
  activeTabId: string;
  storageError?: string;
}

export function createBuildTab(build: Gw2ApplicationBuild, name = 'New build', patchId = 'current'): BuildTab {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 80) || 'New build',
    build,
    patchId,
    session: emptyBuildTabSession(),
    resultsFresh: false
  };
}

/** A new storage envelope preserves the legacy single build as a migration fallback. */
export function workspaceStorageKey(adapter: Gw2AppAdapter): string {
  return `${adapter.storageKey}-workspace-v1`;
}

export function loadBuildWorkspace(adapter: Gw2AppAdapter): BuildWorkspace {
  try {
    const saved = JSON.parse(localStorage.getItem(workspaceStorageKey(adapter)) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.tabs)) {
      const tabs: BuildTab[] = [];
      for (const entry of saved.tabs) {
        try {
          if (
            !entry ||
            typeof entry.id !== 'string' ||
            !entry.id ||
            typeof entry.name !== 'string' ||
            !entry.build ||
            typeof entry.build !== 'object' ||
            Array.isArray(entry.build) ||
            entry.build.profession !== adapter.id ||
            tabs.some((tab) => tab.id === entry.id)
          )
            continue;
          const tab = createBuildTab(replaceBuild(entry.build, adapter), entry.name);
          tab.id = entry.id;
          // Removed preview patches fall back to current data without discarding the build.
          try {
            if (typeof entry.patchId === 'string' && adapter.profession.catalogFor?.(entry.patchId)) {
              tab.patchId = entry.patchId;
            }
          } catch {
            /* The saved preview is no longer available. */
          }

          tabs.push(tab);
        } catch {
          /* One invalid tab must not discard the remaining builds. */
        }
      }

      if (tabs.length) {
        return { tabs, activeTabId: tabs.find((tab) => tab.id === saved.activeTabId)?.id || tabs[0].id };
      }
    }
  } catch {
    /* Missing or inaccessible storage still permits an in-memory workspace. */
  }

  const tab = createBuildTab(loadBuild(adapter), 'Build 1');
  return { tabs: [tab], activeTabId: tab.id };
}

/** Snapshots references owned by the outgoing tab without cloning large simulation results. */
export function captureActiveBuildTab(app: ProfessionAppState): void {
  const tab = app.workspace?.tabs.find(({ id }) => id === app.workspace?.activeTabId);
  if (!tab) return;
  tab.build = app.build;
  tab.patchId = app.patchId;
  tab.session = Object.fromEntries(
    Object.keys(emptyBuildTabSession()).map((key) => [key, app[key as keyof BuildTabSession]])
  ) as BuildTabSession;
  tab.resultsFresh =
    app.results !== null && app.resultRevision === app.buildRevision && app.simulationStatus === 'idle';
}

/** Persists only durable inputs; caches and undo stacks stay in this browser session. */
export function saveBuildWorkspace(app: ProfessionAppState): void {
  const workspace = app.workspace;
  if (!workspace) return;
  captureActiveBuildTab(app);
  try {
    localStorage.setItem(
      workspaceStorageKey(app.adapter),
      JSON.stringify({
        version: 1,
        activeTabId: workspace.activeTabId,
        tabs: workspace.tabs.map(({ id, name, build, patchId }) => ({
          id,
          name,
          patchId,
          build: app.profession.migrateBuild(build)
        }))
      })
    );
    workspace.storageError = '';
  } catch {
    workspace.storageError = 'Tabs could not be saved in this browser. Export builds before leaving.';
  }
}

/** New and duplicated tabs receive independent build values and fresh editing history. */
export function addBuildTab(
  app: ProfessionAppState,
  build = createDefaultBuild(app.adapter),
  name = 'New build',
  patchId = app.patchId
): BuildTab | undefined {
  if (!app.workspace || !app.activateBuildTab) return;
  const tab = createBuildTab(structuredClone(build), name, patchId);
  app.workspace.tabs.push(tab);
  app.activateBuildTab(tab.id);
  return tab;
}

/** Closing the active tab selects its neighbor; the final build always stays open. */
export function closeBuildTab(app: ProfessionAppState, id: string): void {
  const workspace = app.workspace;
  if (!workspace || workspace.tabs.length === 1) return;
  const index = workspace.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  captureActiveBuildTab(app);
  if (id === workspace.activeTabId) {
    const neighbor = workspace.tabs[index + 1] || workspace.tabs[index - 1];
    app.activateBuildTab?.(neighbor.id);
  }

  workspace.tabs.splice(index, 1);
  saveBuildWorkspace(app);
}

/** Async replacements must still target the same unchanged tab when their input finishes loading. */
export function captureBuildDestination(app: ProfessionAppState): () => void {
  const tabId = app.workspace?.activeTabId;
  const revision = app.buildRevision;
  return () => {
    if (app.workspace?.activeTabId !== tabId || app.buildRevision !== revision) {
      throw new Error('The build changed while loading. Load it again in the intended tab.');
    }
  };
}
