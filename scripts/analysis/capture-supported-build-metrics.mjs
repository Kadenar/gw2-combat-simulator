/**
 * Runs the deterministic simulator over every rotation-backed manifest preset and
 * prints the resulting benchmark metrics as JSON.
 *
 * For each requested profession it loads the build manifest, simulates each preset
 * that has a rotation through the profession's build context, and records duration,
 * DPS, APM, cumulative and phase DPS by target health, total/strike/condition damage, the final damaging packet,
 * and any warnings. Non-killing runs use final overall DPS for both final-band measurements.
 * Benchmark comparison consumes these metrics to report drift and update manifests.
 *
 * Also exported as `captureSupportedBuildMetrics(professions?)` for reuse without
 * spawning the CLI. When run directly, positional args pick professions; with none
 * it captures all registered professions in alphabetical order.
 *
 * Usage: node scripts/analysis/capture-supported-build-metrics.mjs [profession...]
 */
import { deterministicSimulationConfig } from '#gw2/build-context/simulation-config.js';
import { formatSimulationDiagnostic } from '#gw2/platform/results/diagnostics.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

import { benchmarkProfessionIds, loadBenchmarkPresets, prepareBenchmarkPreset } from '../lib/benchmark-presets.mjs';
import { parseGameOption } from '../lib/game-data.mjs';
import { targetHealthBandDps } from './health-band-dps.mjs';

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
  const {
    build,
    profession,
    rotation,
    config: preparedConfig
  } = prepareBenchmarkPreset({ adapter, savedBuild, savedRotation }, patchId);
  const config = deterministicSimulationConfig(preparedConfig);
  // Benchmarks need combat events and APM, but never consume chart histories or projected party-boon reports.
  return {
    build,
    result: simulateGw2({ profession, rotation, config, collectChartData: false })
  };
}

export async function captureSupportedBuildMetrics(
  professions = [...benchmarkProfessionIds].sort(),
  { gameId = 'gw2', patchId = 'current' } = {}
) {
  const metrics = [];
  for await (const { identity, adapter, savedBuild, savedRotation } of loadBenchmarkPresets(professions, { gameId })) {
    const { build, result } = simulateBenchmarkPreset(adapter, savedBuild, savedRotation, patchId);
    const finalPacket = finalDamagingPacket(result);

    metrics.push({
      id: identity.id,
      profession: identity.profession,
      patchId,
      section: identity.section,
      label: identity.label,
      build: identity.build,
      rotation: identity.rotation,
      benchmarkDps: identity.benchmarkDps,
      benchmarkApm: identity.benchmarkApm,
      benchmarkDpsByHealth: identity.benchmarkDpsByHealth,
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
      // Metrics are a printed report, so diagnostics carry their occurrence time as text.
      warnings: result.warnings.map(formatSimulationDiagnostic)
    });
  }

  return metrics;
}

// Only print metrics for direct CLI invocations; importers choose when to run simulations.
if (import.meta.main) {
  const { gameId, args: requested } = parseGameOption(process.argv.slice(2));
  const metrics = await captureSupportedBuildMetrics(requested.length ? requested : undefined, { gameId });

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}
