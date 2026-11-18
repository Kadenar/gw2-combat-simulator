import type { Gw2Stats } from '#gw2/platform/attributes/stats.js';
import { createChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import { necromancerLifeForceCapacity, type NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { clamp } from '#kernel/core/numeric.js';
import { createPeriodicTaskState } from '#kernel/execution/periodic-task.js';
import { createResourceClock } from '#kernel/resources/accrual.js';

/** Creates fresh Core Necromancer resources, transforms, summons, and trait proc state from a build config. */
export function createNecromancerCoreState(
  config: NecromancerConfig,
  preparation: { attributes: Gw2Stats; balanceContext: ProfessionBalanceContext }
): NecromancerCoreState {
  // Saved starting life force is a percentage; runtime state stores points against the selected capacity.
  const maximum = necromancerLifeForceCapacity(
    config,
    preparation.balanceContext.catalog,
    preparation.attributes.vitality ?? 1000
  );
  const state: NecromancerCoreState = {
    // Begin with two dodges; the shared controller advances regeneration and Vigor.
    endurance: createResourceClock(ENDURANCE.maximum),
    lifeForce: {
      value: (clamp(config.initialResource ?? 100, 0, 100) * maximum) / 100,
      maximum,
      unitsPerSecond: 0,
      updatedAt: 0
    },
    signetPassives: {
      undeath: { ...createPeriodicTaskState(), occurrence: 0, interval: 0 },
      vampirism: { ...createPeriodicTaskState(), occurrence: 0, interval: 0 }
    },
    eternalLife: { ...createPeriodicTaskState(), occurrence: 0, interval: 0 },
    activeShroud: '',
    activeShroudEntryId: null,
    activeShroudExitId: null,
    soulShardGrant: createChargeGrant(0, 0),
    carapaceExpiries: [],
    activeMinions: {},
    minionAttackGenerations: {},
    minionAttackCursors: {},
    swordChainGeneration: 0,
    selfConditions: [],
    plagueSendingArmed: false,
    lichEndsAt: 0,
    lichGeneration: 0,

    tasteForBloodGrants: {}
  };
  return state;
}
