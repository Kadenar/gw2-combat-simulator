import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '#gw2/platform/builds/assumptions.js';
import { buildAssumptionControls } from '#gw2/professions/shared/build-assumptions.js';
import { createGw2BuildCodec } from '#gw2/platform/builds/codec.js';
import type { Gw2BuildCodec, Gw2BuildCodecOptions, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { ProfessionAssumptionControl, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';

interface ProfessionBuildCodecOptions<TBuild extends Gw2CanonicalBuild> extends Gw2BuildCodecOptions<TBuild> {
  readonly assumptionControls?: readonly ProfessionAssumptionControl[];
}

/** Creates declared assumption defaults for new builds; persisted values are normalized by the codec. */
export function createProfessionAssumptionDefaults(
  controls: readonly ProfessionAssumptionControl[]
): ProfessionBuildAssumptions {
  return normalizeProfessionAssumptions({}, buildAssumptionControls(controls));
}

/**
 * Wraps the platform codec with shared assumption controls while leaving
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
