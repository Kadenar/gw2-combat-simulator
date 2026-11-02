/** Load manifest cases and prepare detached build inputs without running or measuring a simulation. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadBuildContext } from '#gw2/build-context/load.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { professionOptions } from '#gw2/profession-registry.js';

import { resolveGameData } from './game-data.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');

export const benchmarkProfessionIds = professionOptions.map(({ id }) => id);

/** Filter manifest identities before reading their inputs, preserving manifest and requested profession order. */
export async function* loadBenchmarkPresets(
  professions = benchmarkProfessionIds,
  { gameId = 'gw2', filter = '', root = repoRoot } = {}
) {
  const unknown = professions.filter((id) => !benchmarkProfessionIds.includes(id));

  if (unknown.length) throw new TypeError(`Unknown professions: ${unknown.join(', ')}.`);

  if (gameId !== 'gw2') throw new TypeError(`Game "${gameId}" has no benchmark simulator.`);

  const data = resolveGameData(root, gameId);
  const readJson = async (file) => JSON.parse(await readFile(path.resolve(root, file), 'utf8'));
  for (const profession of professions) {
    const [manifest, adapter] = await Promise.all([
      readJson(path.join(data.builds, profession, 'manifest.json')),
      loadBuildContext(profession)
    ]);

    if (!adapter) throw new Error(`${profession} has no build-context binding.`);

    for (const section of manifest) {
      for (const preset of section.presets) {
        if (!preset.rotation) continue;

        const identity = {
          ...preset,
          id: `${profession}|${section.section || ''}|${preset.label}`,
          profession,
          section: section.section || ''
        };

        if (!identity.id.toLowerCase().includes(filter.toLowerCase())) continue;

        const [savedBuild, savedRotation] = await Promise.all([readJson(preset.build), readJson(preset.rotation)]);
        yield { identity, adapter, savedBuild, savedRotation };
      }
    }
  }
}

/** Resolve patch state before recalculation, keeping saved inputs independent of each prepared candidate. */
export function prepareBenchmarkPreset({ identity, adapter, savedBuild, savedRotation }, patchId = 'current') {
  const build = adapter.toApplicationBuild({
    ...structuredClone(savedBuild),
    rotation: structuredClone(savedRotation.rotation ?? savedRotation)
  });
  const context = adapter.createBuildContext({
    build,
    transitionDelays: normalizeTransitionDelays(),
    patch: adapter.profession.resolvePatch({ id: patchId })
  });
  return {
    identity,
    build,
    // The adapter owns the simulation runtime; build contexts only calculate build-derived values.
    profession: adapter.profession,
    rotation: build.rotation,
    config: context.simulationConfig()
  };
}
