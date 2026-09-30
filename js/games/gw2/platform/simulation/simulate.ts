import { createGw2Runtime, runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import type { CombatSession } from '#gw2/platform/simulation/combat.js';
import { normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2SimulationOptions, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

/**
 * Canonical GW2 simulation entry point.
 *
 * Validate shared inputs once, then execute every profession through the same live runtime.
 */
export function simulateGw2(options: Gw2SimulationOptions & { output: 'score' }): Gw2SimulationScore;
export function simulateGw2(options: Gw2SimulationOptions & { output?: 'detailed' }): Gw2SimulationResult;
export function simulateGw2(
  options: Gw2SimulationOptions & { output?: 'detailed' | 'score' }
): Gw2SimulationResult | Gw2SimulationScore {
  return runGw2Runtime({ ...options, ...prepareCombat(options), observation: options.observationPolicy });
}

/** Build preparation is identical for full replay and incremental execution. */
function prepareCombat(options: Gw2SimulationOptions) {
  const started = options.onPhase ? performance.now() : 0;
  let config = options.config ?? {};
  if (config.procRateOverrides !== undefined)
    config = { ...config, procRateOverrides: normalizeProcRateOverrides(config.procRateOverrides) };
  if (config.selectedSkills != null)
    config = { ...config, selectedSkills: prepareSelectedSkillLoadout(config.selectedSkills) };
  const profession = options.profession.runtimeFor(config);
  options.onPhase?.('preparation', performance.now() - started);
  return { profession, config };
}

/** Start an empty, fixed-window encounter. Other families need their private mutable facts audited before opting in. */
export function initializeGw2Combat(
  options: Omit<Gw2SimulationOptions, 'rotation' | 'observationPolicy'> & { durationMs: number }
): CombatSession {
  if (!Number.isFinite(options.durationMs) || options.durationMs <= 0)
    throw new RangeError('Combat duration must be positive and finite.');
  if (options.profession.id !== 'guardian')
    throw new TypeError('Combat snapshots currently support Guardian; other families require a private-state audit.');
  const prepared = prepareCombat({ ...options, config: structuredClone(options.config), rotation: [] });
  const runtime = createGw2Runtime({
    ...prepared,
    rotation: [],
    observation: { kind: 'absolute', endTimeMs: options.durationMs },
    output: 'score',
    combatStartTime: 0
  });
  runtime.start();
  return runtime.session;
}
