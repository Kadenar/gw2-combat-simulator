import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
/**
 * Runs the deterministic simulator over every rotation-backed manifest preset and
 * prints the resulting benchmark metrics as JSON.
 *
 * For each requested profession it loads the build manifest, simulates each preset
 * that has a rotation through the profession's build context, and records duration,
 * DPS, APM, cumulative and phase DPS by target health, total/strike/condition damage, the final damaging packet,
 * and any warnings. Non-killing runs use final overall DPS for both final-band measurements.
 * The output is a stable baseline that other tooling diffs against (see
 * render-supported-build-metrics-report.mjs).
 *
 * Also exported as `captureSupportedBuildMetrics(professions?)` for reuse without
 * spawning the CLI. When run directly, positional args pick professions; with none
 * it captures all of DEFAULT_PROFESSIONS.
 *
 * Usage: node scripts/analysis/capture-supported-build-metrics.mjs [profession...]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadBuildContext } from '#gw2/build-context/load.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { deterministicSimulationConfig } from '#gw2/build-context/simulation-config.js';
import { targetHealthBandDps } from '#gw2/app/results/summary-metrics.js';
import { parseGameOption, resolveGameData } from '../lib/game-data.mjs';

const DEFAULT_PROFESSIONS = [
  'elementalist',
  'engineer',
  'guardian',
  'mesmer',
  'necromancer',
  'ranger',
  'revenant',
  'thief',
  'warrior'
];

const repoRoot = path.resolve(import.meta.dirname, '../..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8'));
}

function finalDamagingPacket(result) {
  const packets = result.resolvedEvents.flatMap((event) => {
    if (event.type === 'damage' && Number(event.damage) > 0) {
      return [{ at: event.at, name: event.name, type: 'strike' }];
    }

    return (event.damageTicks || []).map((tick) => ({
      at: tick.at,
      name: event.name,
      type: 'condition'
    }));
  });

  return packets.sort((left, right) => left.at - right.at).at(-1) || null;
}

/** Build independent patch state before recalculation so capture never mixes live attributes with preview effects. */
export function simulateBenchmarkPreset(adapter, savedBuild, savedRotation, patchId = 'current') {
  const build = adapter.toApplicationBuild({
    ...structuredClone(savedBuild),
    rotation: structuredClone(savedRotation.rotation ?? savedRotation)
  });
  const context = adapter.createBuildContext({ build, patchId, transitionDelays: normalizeTransitionDelays() });
  const config = deterministicSimulationConfig(context.simulationConfig());
  return { build, result: simulateGw2({ profession: context.profession, rotation: build.rotation, config }) };
}

async function captureProfession(professionId, gameId, patchId) {
  if (gameId !== 'gw2') throw new TypeError(`Game "${gameId}" has no benchmark simulator.`);
  const data = resolveGameData(repoRoot, gameId);
  const [manifest, adapter] = await Promise.all([
    readJson(path.relative(repoRoot, path.join(data.builds, professionId, 'manifest.json'))),
    loadBuildContext(professionId)
  ]);

  if (!adapter) throw new Error(`${professionId} has no build-context binding.`);

  const metrics = [];

  for (const section of manifest) {
    for (const preset of section.presets) {
      if (!preset.rotation) continue;
      const [savedBuild, savedRotation] = await Promise.all([readJson(preset.build), readJson(preset.rotation)]);
      const { build, result } = simulateBenchmarkPreset(adapter, savedBuild, savedRotation, patchId);
      const finalPacket = finalDamagingPacket(result);

      metrics.push({
        id: `${professionId}|${section.section || ''}|${preset.label}`,
        profession: professionId,
        patchId,
        section: section.section || '',
        label: preset.label,
        build: preset.build,
        rotation: preset.rotation,
        benchmarkDps: preset.benchmarkDps,
        benchmarkApm: preset.benchmarkApm,
        benchmarkDpsByHealth: preset.benchmarkDpsByHealth,
        rotationEndTime: result.rotationEndTime,
        observationEndTime: result.observationEndTime,
        combatEndTime: result.combatEndTime,
        dpsStartTime: result.dpsStartTime,
        dpsWindow: result.dpsWindow,
        deathTime: result.deathTime,
        lastHitTime: result.lastHitTime,
        dps: result.dps,
        // Reuse the simulator's input accounting rather than estimating actions from saved rotation length.
        ...(patchId === 'current' ? { apm: result.rotationApm.apm } : {}),
        // Measure each band within the same simulation, including its live target-health modifiers.
        dpsByHealth: targetHealthBandDps(result, build.targetHealth, build.targetStartingHealthPercent ?? 100),
        totalDamage: result.totalDamage,
        strikeDamage: result.strikeDamage,
        conditionDamage: result.conditionDamage,
        finalDamagingPacket: finalPacket,
        warnings: [...result.warnings]
      });
    }
  }

  return metrics;
}

export async function captureSupportedBuildMetrics(
  professions = DEFAULT_PROFESSIONS,
  { gameId = 'gw2', patchId = 'current' } = {}
) {
  const unknown = professions.filter((profession) => !DEFAULT_PROFESSIONS.includes(profession));

  if (unknown.length) {
    throw new TypeError(`Unknown professions: ${unknown.join(', ')}.`);
  }

  const metrics = [];

  for (const profession of professions) {
    metrics.push(...(await captureProfession(profession, gameId, patchId)));
  }

  return metrics;
}

// Only print metrics for direct CLI invocations; importers choose when to run simulations.
if (import.meta.main) {
  const { gameId, args: requested } = parseGameOption(process.argv.slice(2));
  const metrics = await captureSupportedBuildMetrics(requested.length ? requested : DEFAULT_PROFESSIONS, { gameId });

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}
