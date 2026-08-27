/**
 * Simulation config preparation. Defines the defaults, overrides, and prepared
 * config shapes and merges caller overrides over defaults while preserving the
 * nested `stats`, `boons`, and `target` boundaries that callers routinely patch.
 */

/**
 * Complete simulation defaults. The nested `stats`, `boons`, and `target`
 * boundaries are always present so merges never dereference `undefined`.
 */
export interface SimulationConfigDefaults {
  readonly duration?: number;
  readonly stats: Readonly<Record<string, unknown>>;
  readonly boons: Readonly<Record<string, unknown>>;
  readonly target: Readonly<Record<string, unknown>> & {
    readonly conditions: Readonly<Record<string, unknown>>;
  };
  readonly [field: string]: unknown;
}

/**
 * Caller overrides. Every nested boundary is optional; only the keys a caller
 * supplies are merged over the defaults.
 */
export interface SimulationConfigOverrides {
  readonly duration?: number;
  readonly stats?: Readonly<Record<string, unknown>>;
  readonly boons?: Readonly<Record<string, unknown>>;
  readonly target?: Readonly<Record<string, unknown>> & {
    readonly conditions?: Readonly<Record<string, unknown>>;
  };
  readonly [field: string]: unknown;
}

export interface PreparedSimulationConfig {
  duration?: number;
  stats: Record<string, unknown>;
  boons: Record<string, unknown>;
  target: Record<string, unknown> & { conditions: Record<string, unknown> };
  [field: string]: unknown;
}

interface PrepareSimulationConfigOptions {
  readonly duration?: number;
}

/**
 * Merges simulation defaults with user overrides while preserving nested object
 * boundaries that callers routinely patch (`stats`, `boons`, and `target`).
 * Target conditions are replaced as a unit when explicitly provided so stale
 * assumptions do not leak in from defaults.
 */
export function prepareSimulationConfig(
  defaults: SimulationConfigDefaults,
  userConfig: SimulationConfigOverrides = {},
  { duration = userConfig.duration }: PrepareSimulationConfigOptions = {}
): PreparedSimulationConfig {
  const hasTargetConditions = Boolean(userConfig.target) && Object.hasOwn(userConfig.target!, 'conditions');

  return {
    ...defaults,
    ...userConfig,
    ...(duration == null ? {} : { duration }),
    stats: { ...defaults.stats, ...(userConfig.stats || {}) },
    boons: { ...defaults.boons, ...(userConfig.boons || {}) },
    target: {
      ...defaults.target,
      ...(userConfig.target || {}),
      conditions: hasTargetConditions ? { ...(userConfig.target?.conditions || {}) } : { ...defaults.target.conditions }
    }
  };
}
