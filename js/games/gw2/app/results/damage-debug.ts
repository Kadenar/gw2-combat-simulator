import type { BaselineSimulationResult } from '#gw2/app/simulation/baseline/types.js';

/** Export captured inputs and hit facts together, without editor state or presentation-only analysis caches. */
export function damageDebugPayload(result: BaselineSimulationResult) {
  if (!result.debugInputs) return null;
  const { debugInputs } = result;
  return {
    ...debugInputs,
    config: { ...debugInputs.config, patchId: debugInputs.patchId, randomness: result.randomness },
    result: {
      randomness: result.randomness,
      totalDamage: result.totalDamage,
      dps: result.dps,
      rotationEndTime: result.rotationEndTime,
      observationEndTime: result.observationEndTime,
      combatEndTime: result.combatEndTime,
      combatStartTime: result.combatStartTime,
      warnings: result.warnings,
      // Preserve full hit identity and precision, including formulas for hits hidden by log filters.
      damageEvents: result.resolvedEvents.filter((event) => event.type === 'damage')
    }
  };
}
