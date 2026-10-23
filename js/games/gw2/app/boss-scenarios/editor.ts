import { createBuildTab, saveBuildWorkspace, type BuildWorkspace } from '#gw2/app/build/state/workspace.js';
import type { BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Each encounter uses the existing build and rotation editor once, with one continuous history. */
export function createScenarioEditor(
  app: ProfessionAppState,
  persist: () => void,
  fileActions: NonNullable<BuildWorkspace['fileActions']>
) {
  const golem = app.workspace!;
  const workspaces = new Map<string, BuildWorkspace>();
  function open(draft: BossScenarioDraft): void {
    let workspace = workspaces.get(draft.id);

    if (!workspace) {
      const tab = createBuildTab(structuredClone(draft.build), draft.buildName, draft.patchId);
      workspace = { tabs: [tab], activeTabId: '', scenario: draft, fileActions };
      workspace.persist = () => {
        draft.build = structuredClone(tab.build);
        draft.patchId = tab.patchId;
        draft.buildName = tab.name;
        persist();
      };

      workspaces.set(draft.id, workspace);
    }

    app.activateBuildTab?.(workspace.tabs[0]!.id, workspace);
  }

  return {
    golem,
    open,
    capture: () => saveBuildWorkspace(app),
    // Release closed encounters and their histories after leaving their active editing session.
    discard: (id: string) => {
      const workspace = workspaces.get(id);

      if (workspace && app.workspace === workspace) app.activateBuildTab?.(golem.activeTabId, golem);

      workspaces.delete(id);
    },
    close: () => {
      if (app.workspace !== golem) app.activateBuildTab?.(golem.activeTabId, golem);
    }
  };
}
