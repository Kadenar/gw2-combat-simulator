import { loadPresetBundle } from '#gw2/app/build/library/assets.js';
import {
  addBuildTab,
  applyRotationSimulationSettings,
  invalidateInactiveBuildTabs,
  saveBuildWorkspace
} from '#gw2/app/build/state/workspace.js';
import { renderBuildTabs } from '#gw2/app/build/workspace-tabs.js';
import { readRotationConditionTickOffset } from '#gw2/app/import-export/rotation-condition-clock.js';
import { readRotationTransitionDelays } from '#gw2/app/import-export/rotation-transition-delays.js';
import { readBenchmarks } from '#gw2/app/page/benchmarks/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { getRotationItems } from '#gw2/integrations/assets.js';

/** Open only a manifest-listed benchmark in a new tab, preserving existing workspace builds and hosting flags. */
export async function openBenchmarkWorkspace(app: ProfessionAppState, root: Document): Promise<void> {
  const view = root.defaultView!;
  const url = new URL(view.location.href);
  const buildPath = url.searchParams.get('benchmark');

  if (!buildPath) return;

  try {
    const response = await fetch(`data/gw2/builds/${app.adapter.id}/manifest.json`);

    if (!response.ok) throw new Error('Benchmark manifest unavailable.');

    const preset = readBenchmarks(app.adapter, await response.json()).find(
      (row) => row.build === buildPath && (row.rotation ?? null) === url.searchParams.get('rotation')
    );

    if (!preset) throw new Error('This benchmark is not listed for this profession.');

    const { buildData, rotationData } = await loadPresetBundle(preset);
    const rotationItems = getRotationItems(rotationData);

    if (!buildData || typeof buildData !== 'object' || Array.isArray(buildData)) throw new Error('Invalid build.');

    if (preset.rotation && !rotationItems) throw new Error('Benchmark rotation unavailable.');

    const build = app.adapter.toApplicationBuild({ ...buildData, rotation: rotationItems ?? [] });
    // Benchmark links use the rotation's clock before the new tab starts its first simulation.
    const settingsChanged = applyRotationSimulationSettings(app, {
      transitionDelays: readRotationTransitionDelays(rotationData),
      conditionTickOffsetMs: readRotationConditionTickOffset(rotationData)
    });
    addBuildTab(app, build, `${preset.specialization} · ${preset.label}`, app.patch.id, build);

    if (settingsChanged) invalidateInactiveBuildTabs(app);

    saveBuildWorkspace(app);
    renderBuildTabs(app);
    // Consume the request after success so a refresh does not create another copy.
    url.searchParams.delete('benchmark');
    url.searchParams.delete('rotation');
    view.history.replaceState(view.history.state, '', url);
  } catch (error) {
    const message = root.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = `Could not open benchmark: ${error instanceof Error ? error.message : String(error)} Reload to retry.`;
    root.getElementById('app')?.prepend(message);
  }
}
