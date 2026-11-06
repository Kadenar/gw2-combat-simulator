import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerConfig, NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

// Resource tuning stays independent of active trait handlers so grants cannot import their callers.
/** Gluttony scales a successful gain once, before the resource controller caps the pool. */
export function gluttonyLifeForceMultiplier(runtime: MechanicQueriesOf<NecromancerRuntime>): number {
  return hasTrait(runtime, TRAIT.GLUTTONY)
    ? balanceNumber(runtime.helpers, TRAIT.GLUTTONY, 'lifeForceGainMultiplier')
    : 1;
}

/** Soul Battery changes capacity, keeping normalized resource costs consistent for every shroud variant. */
export function soulBatteryCapacity(config: NecromancerConfig, source: BalanceProfileSource): number {
  return hasTrait(config, TRAIT.SOUL_BATTERY)
    ? balanceNumber(source, TRAIT.SOUL_BATTERY, 'lifeForceCapacityMultiplier')
    : 1;
}
