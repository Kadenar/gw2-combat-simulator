/** Captures tab-owned editing state by reference, keeping shared preferences and browser controls outside the tab. */
import { emptyBuildLibrarySession, type BuildLibrarySession } from '#gw2/app/build/library/state.js';
import type { BuildWorkspace } from '#gw2/app/build/state/workspace.js';
import { emptyResultViewState, type ResultViewState } from '#gw2/app/results/state.js';
import { emptyRotationComparisonSession, type RotationComparisonSession } from '#gw2/app/rotation/comparison-state.js';
import { editRotation } from '#gw2/app/rotation/editing/session.js';
import {
  emptyRotationEditingSession,
  type ProfessionRotationDragState,
  type RotationEditingSession
} from '#gw2/app/rotation/editing/state.js';
import { emptyRotationTimelineSession, type RotationTimelineSession } from '#gw2/app/rotation/timeline/state.js';
import type { AnalysisResultLifecycle } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { BuildAttributes } from '#gw2/build-context/types.js';
import type { ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

export interface BuildTabSession
  extends
    BuildLibrarySession,
    RotationEditingSession,
    RotationTimelineSession,
    RotationComparisonSession,
    ResultViewState {
  attributeData: BuildAttributes | null;
  attributeWeaponSet: number;
}

/** Stores patch tuning with the tab so activation can resolve its patch. */
export type StoredBuildTabSession = BuildTabSession & { patchPreviewValues?: Readonly<Record<string, number>> };

export interface BuildTabCaptureState extends BuildTabSession {
  workspace?: BuildWorkspace;
  build: Gw2CanonicalBuild;
  patch: ResolvedPatch;
  readonly analysis: Pick<AnalysisResultLifecycle, 'capture'>;
}

export function emptyBuildTabSession(): BuildTabSession {
  return {
    attributeData: null,
    attributeWeaponSet: 1,
    ...emptyBuildLibrarySession(),
    ...emptyRotationEditingSession(),
    ...emptyRotationTimelineSession(),
    ...emptyRotationComparisonSession(),
    ...emptyResultViewState()
  };
}

/** Retains references to each tab's results, history, and filters to avoid copying them on every switch. */
export function captureActiveBuildTab(state: BuildTabCaptureState): void {
  const tab = state.workspace?.tabs.find(({ id }) => id === state.workspace?.activeTabId);

  if (!tab) return;

  tab.build = state.build;
  tab.patchId = state.patch.id;
  tab.session = Object.fromEntries(
    Object.keys(emptyBuildTabSession()).map((key) => [key, state[key as keyof BuildTabSession]])
  ) as unknown as BuildTabSession;
  tab.session.patchPreviewValues = state.patch.values;
  tab.analysis = state.analysis.capture();
}

/** Installation clears outgoing fields even when the destination uses an empty session. */
export function installBuildTabSession(
  state: BuildTabSession & { build: Gw2CanonicalBuild; dragState: ProfessionRotationDragState | null },
  session: StoredBuildTabSession
): void {
  const { patchPreviewValues: _patchPreviewValues, ...editing } = session;
  Object.assign(state, editing);
  const selection = editRotation(state.build.rotation, state, {
    type: 'select',
    index: state.rotationInsertionIndex ?? null
  });

  if (selection) Object.assign(state, selection.session);

  state.dragState = null;
}
