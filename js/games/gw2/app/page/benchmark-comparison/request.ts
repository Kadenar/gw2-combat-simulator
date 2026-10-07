import { loadPresetBundle } from '#gw2/app/build/library/assets.js';
import { deterministicSimulationConfig } from '#gw2/app/simulation/build-config.js';
import { loadProfessionAppAdapter } from '#gw2/profession-registry.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import type { Gw2AppAdapter, ProfessionAppState } from '#gw2/app/types.js';
import type { ComparisonRequest } from '#gw2/app/page/benchmark-comparison/model.js';

/** Use the same canonical build codec and attribute/configuration pipeline as the workspace and preset checks. */
export function prepareComparisonRequest(
  adapter: Gw2AppAdapter,
  buildData: unknown,
  rotationItems: unknown
): ComparisonRequest {
  if (!buildData || typeof buildData !== 'object' || Array.isArray(buildData)) throw new Error('Invalid saved build.');
  if (!Array.isArray(rotationItems) || !rotationItems.length) throw new Error('A saved rotation is required.');
  const build = adapter.toApplicationBuild({ ...buildData, rotation: rotationItems });
  const activeCatalog = adapter.profession.catalogFor?.('current') ?? adapter.profession.catalog;
  // This preparation seam needs only build state, not a mounted editor or any persisted workspace mutation.
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    activeCatalog,
    patchId: 'current',
    skillByName: activeCatalog.skillsByName,
    skillById: activeCatalog.skillsById,
    attributeWeaponSet: build.startingWeaponSet,
    results: null
  } as ProfessionAppState;
  adapter.recalculate(app);
  return {
    gameId: 'gw2',
    contentId: adapter.id,
    rotation: build.rotation,
    config: deterministicSimulationConfig(adapter.simulationConfig(app))
  };
}

/** Load only requested preset assets; a missing rotation is an actionable failure, never an empty successful run. */
export async function loadComparisonRequest(row: Benchmark): Promise<ComparisonRequest> {
  if (!row.rotation) throw new Error('This preset has no saved rotation.');
  const [adapter, bundle] = await Promise.all([loadProfessionAppAdapter(row.profession), loadPresetBundle(row)]);
  if (!adapter) throw new Error(`Unknown profession: ${row.profession}`);
  return prepareComparisonRequest(adapter, bundle.buildData, bundle.rotationItems);
}
