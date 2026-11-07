/** Switches the editing document and analysis ownership before the browser paints the destination. */
import { normalizeSelectedSkillsAndAttributes } from '#gw2/app/build/state/skill-selection.js';
import {
  captureActiveBuildTab,
  installBuildTabSession,
  type BuildTabCaptureState
} from '#gw2/app/build/state/tab-session.js';
import { persistBuildWorkspace, type BuildWorkspace } from '#gw2/app/build/state/workspace.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

type BuildTabActivationState = BuildTabCaptureState &
  Pick<
    ProfessionAppState,
    | 'simulationSettings'
    | 'dragState'
    | 'profession'
    | 'adapter'
    | 'analysis'
    | 'gearOptimizerRunner'
    | 'relicComparisonRunner'
  >;

/** Missing and active destinations do nothing; a switch advances analysis identity and resumes only missing work. */
export function activateBuildTab(
  state: BuildTabActivationState,
  { workspace = state.workspace, tabId }: { workspace?: BuildWorkspace; tabId: string }
): boolean {
  if (!workspace || (workspace === state.workspace && tabId === workspace.activeTabId)) return false;

  const tab = workspace.tabs.find((entry) => entry.id === tabId);

  if (!tab) return false;

  // Force lazy catalog validation before saving, cancelling work, or replacing the active document.
  const patch = state.profession.resolvePatch({ id: tab.patchId, values: tab.session.patchPreviewValues });
  void patch.catalog;
  captureActiveBuildTab(state);

  if (state.workspace) persistBuildWorkspace(state.workspace, state.adapter);

  state.analysis.suspend();
  state.gearOptimizerRunner?.reset();
  state.workspace = workspace;
  state.simulationSettings = workspace.simulationSettings;
  workspace.activeTabId = tabId;
  state.build = tab.build;
  state.patch = patch;
  installBuildTabSession(state, tab.session);
  state.analysis.restore(tab.analysis);
  normalizeSelectedSkillsAndAttributes(state);
  state.relicComparisonRunner.schedule();
  state.analysis.resume();
  captureActiveBuildTab(state);
  persistBuildWorkspace(workspace, state.adapter);
  return true;
}
