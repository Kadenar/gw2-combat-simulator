import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '../../app/profession/assumptions.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '../../app/simulation/randomness.js';
import { createGw2BuildCodec } from '../../platform/gw2/builds/codec.js';
import type { Gw2BuildCodec, Gw2BuildCodecOptions, Gw2CanonicalBuild } from '../../platform/gw2/builds/types.js';
import type { ProfessionAssumptionControl } from '../../app/profession/types.js';
import type { SchedulerRecord } from '../../platform/engine/types.js';

export interface ProfessionBuildCodecOptions<TBuild extends Gw2CanonicalBuild> extends Gw2BuildCodecOptions<TBuild> {
  readonly assumptionControls?: readonly ProfessionAssumptionControl[];
}

/**
 * Combines profession controls with the shared randomness control once so
 * build defaults, migration, and validation use the same app-owned schema.
 */
function buildAssumptionControls(
  controls: readonly ProfessionAssumptionControl[] = []
): readonly ProfessionAssumptionControl[] {
  const professionKeys = new Set(controls.map((control) => control.key));
  return [
    ...controls,
    ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS.filter((control) => !professionKeys.has(control.key))
  ];
}

/** Normalizes the assumptions persisted by a profession build definition. */
export function normalizeProfessionBuildAssumptions(
  assumptions: SchedulerRecord = {},
  controls: readonly ProfessionAssumptionControl[] = []
): SchedulerRecord {
  return normalizeProfessionAssumptions(assumptions, buildAssumptionControls(controls));
}

/**
 * Wraps the platform codec with app-layer assumption controls while leaving
 * profession-specific migrations and repairs in each profession module.
 */
export function createProfessionBuildCodec<TBuild extends Gw2CanonicalBuild>({
  assumptionControls = [],
  normalizeExtra,
  validateExtra,
  ...options
}: ProfessionBuildCodecOptions<TBuild>): Readonly<Gw2BuildCodec<TBuild>> {
  const controls = buildAssumptionControls(assumptionControls);
  return createGw2BuildCodec<TBuild>({
    ...options,
    normalizeExtra(build, context) {
      const normalized = {
        ...build,
        assumptions: normalizeProfessionAssumptions(build.assumptions, controls)
      };
      return normalizeExtra ? normalizeExtra(normalized, context) : normalized;
    },
    validateExtra(build) {
      const errors = validateProfessionAssumptions(build.assumptions, controls);
      const extra = validateExtra?.(build);
      errors.push(...(Array.isArray(extra) ? extra : extra?.errors || []).map(String));
      return errors;
    }
  });
}
