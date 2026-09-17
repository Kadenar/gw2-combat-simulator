/** Keeps preview request identity outside saved builds and shares it between baseline and cursor workers. */
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { CombatPreviewSimulationRequest } from '#gw2/app/simulation/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { rejectPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';

export const PREVIEW_ANALYSIS_UNAVAILABLE =
  'This analysis is unavailable in the new engine preview. Select Legacy to use it.';

/** Reject unsupported analyses before they can build a legacy request from a preview editor. */
export function requireLegacyAnalysis(app: Pick<ProfessionAppState, 'previewSelection'>): void {
  if (app.previewSelection) throw new TypeError(PREVIEW_ANALYSIS_UNAVAILABLE);
}

export function combatPreviewRequest(app: ProfessionAppState): CombatPreviewSimulationRequest {
  if (Object.values(app.simulationSettings?.transitionDelays ?? {}).some((delay) => delay !== 0))
    rejectPreviewInput(
      'simulationSettings.transitionDelays',
      'Non-zero transition delays are unsupported. Select Legacy and reset transition delays to zero before using this preview.'
    );
  const selection = app.previewSelection!;
  return {
    gameId: app.gameId,
    contentId: app.contentId,
    operation: 'baseline',
    output: 'detailed',
    selection: {
      engine: 'preview',
      contentRevision: selection.contentRevision,
      patchId: selection.patchId,
      build: app.profession.migrateBuild(app.build) as Gw2CanonicalBuild
    },
    seed: selection.seed ?? 1,
    rotation: structuredClone(app.build.rotation)
  };
}
