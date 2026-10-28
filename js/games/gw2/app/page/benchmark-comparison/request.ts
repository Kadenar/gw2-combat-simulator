import type { ComparisonRequest } from '#gw2/app/page/benchmark-comparison/model.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import { loadBuildContext } from '#gw2/build-context/load.js';
import { deterministicSimulationConfig } from '#gw2/build-context/simulation-config.js';
import type { BuildContextModule } from '#gw2/build-context/types.js';
import { fetchJsonAsset, getRotationItems } from '#gw2/integrations/assets.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

/** Use the same canonical build codec and attribute/configuration pipeline as the workspace and preset checks. */
export function prepareComparisonRequest(
  adapter: BuildContextModule,
  buildData: unknown,
  rotationItems: unknown
): ComparisonRequest {
  if (!buildData || typeof buildData !== 'object' || Array.isArray(buildData)) throw new Error('Invalid saved build.');

  if (!Array.isArray(rotationItems) || !rotationItems.length) throw new Error('A saved rotation is required.');

  const build = adapter.toApplicationBuild({ ...buildData, rotation: rotationItems });
  const context = adapter.createBuildContext({
    build,
    patch: adapter.profession.resolvePatch(),
    transitionDelays: normalizeTransitionDelays(undefined)
  });
  return {
    gameId: 'gw2',
    contentId: adapter.profession.id,
    rotation: build.rotation,
    config: deterministicSimulationConfig(context.simulationConfig())
  };
}

/** Load only requested preset assets; a missing rotation is an actionable failure, never an empty successful run. */
export async function loadComparisonRequest(row: Benchmark, buildData: unknown): Promise<ComparisonRequest> {
  if (!row.rotation) throw new Error('This preset has no saved rotation.');

  const [adapter, rotationData] = await Promise.all([
    loadBuildContext(row.profession),
    fetchJsonAsset(row.rotation, { optional: true })
  ]);

  if (!adapter) throw new Error(`Unknown profession: ${row.profession}`);

  return prepareComparisonRequest(adapter, buildData, getRotationItems(rotationData));
}
