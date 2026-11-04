/** Reuses fresh patch results across version switches and refreshes missing comparisons only on Analysis entry. */
import { buildWithPatchSkillSelections } from '#gw2/app/build/state/skill-selection.js';
import type { BaselineSimulationResult, PatchComparison } from '#gw2/app/simulation/baseline/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

interface VisitedPatchResults {
  readonly environment: string;
  readonly results: Map<
    string,
    { readonly result: BaselineSimulationResult; readonly values: string; readonly build: string }
  >;
}

const visited = new WeakMap<Gw2CanonicalBuild, VisitedPatchResults>();

/** Compare the selections a real switch would use, including any repairs made during that switch. */
function patchBuildKey(app: ProfessionAppState, patchId: string): string {
  return JSON.stringify(
    patchId === app.patch.id
      ? app.build
      : buildWithPatchSkillSelections(app, app.profession.resolvePatch({ id: patchId }).catalog)
  );
}

function savedPatchResult(app: ProfessionAppState, patchId: string): BaselineSimulationResult | null {
  if (app.workspace?.scenario) return null;

  const cache = visited.get(app.build);

  if (!cache || cache.environment !== JSON.stringify(app.simulationSettings)) return null;

  const saved = cache.results.get(patchId);

  if (!saved || saved.build !== patchBuildKey(app, patchId)) return null;

  if (patchId !== 'current' && saved.values !== JSON.stringify(app.patch.values ?? {})) return null;

  return saved.result;
}

/** Restore an already computed baseline only when its build, settings, tuning, and diagnostic mode still match. */
export function reusablePatchResult(app: ProfessionAppState): BaselineSimulationResult | null {
  if (!app.profession?.preview) return null;

  const result = savedPatchResult(app, app.patch.id);
  return result && Boolean(result.debugInputs) === Boolean(app.damageDiagnostics) ? result : null;
}

/** A build or rotation edit invalidates both sides, while a patch switch preserves the previously visited side. */
export function invalidatePatchResults(app: ProfessionAppState): void {
  visited.delete(app.build);
  app.patchComparison = null;
}

/** Publish comparison data only for matching workspace settings and the currently displayed preview assumptions. */
export function recordPatchResult(
  app: ProfessionAppState,
  result: BaselineSimulationResult,
  patchId?: string
): PatchComparison | null {
  const preview = app.profession?.preview;

  if (!preview || app.workspace?.scenario) return null;

  const environment = JSON.stringify(app.simulationSettings);
  let cache = visited.get(app.build);

  if (!cache || cache.environment !== environment) {
    cache = { environment, results: new Map() };
    visited.set(app.build, cache);
  }

  const values = JSON.stringify(app.patch.values ?? {});
  const id = patchId ?? app.patch.id;
  cache.results.set(id, { result, values, build: patchBuildKey(app, id) });
  const current = savedPatchResult(app, 'current');
  const next = savedPatchResult(app, preview.id);

  // Switching to Live resets session tuning; never label an older tuned preview as the default preview.
  return current && next ? { current, preview: next } : null;
}

/** Analysis requires both fresh versions, while Bosses and professions without a preview have no comparison. */
export function needsPatchComparison(app: ProfessionAppState): boolean {
  const preview = app.profession?.preview;

  if (!preview || app.workspace?.scenario || app.patchComparison) return false;

  const opposite = app.patch.id === 'current' ? preview.id : 'current';
  return !savedPatchResult(app, opposite);
}
