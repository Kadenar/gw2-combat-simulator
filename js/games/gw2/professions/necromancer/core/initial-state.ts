import type { Gw2Stats } from '#gw2/platform/attributes/stats.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import { createPeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import { necromancerLifeForceCapacity, type NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { clamp } from '#kernel/core/numeric.js';

/** Creates fresh Core Necromancer resources, transforms, summons, and trait proc state from a build config. */
export function createNecromancerCoreState(
  config: NecromancerConfig,
  preparation: { attributes: Gw2Stats; balanceContext: ProfessionBalanceContext }
): NecromancerCoreState {
  // Saved starting life force is a percentage; runtime state stores points against the selected capacity.
  const maximum = necromancerLifeForceCapacity(
    config,
    preparation.balanceContext,
    preparation.attributes.vitality ?? 1000
  );
  const state: NecromancerCoreState = {
    // Begin with two dodges; the shared controller advances regeneration and Vigor.
    endurance: createResourceClock(ENDURANCE.maximum),
    lifeForce: {
      value: (clamp(config.initialResource ?? 100, 0, 100) * maximum) / 100,
      maximum,
      rate: 0,
      updatedAt: 0
    },
    signetPassives: {
      undeath: { ...createPeriodicTaskState(), deadline: Infinity, interval: 0 },
      vampirism: { ...createPeriodicTaskState(), deadline: Infinity, interval: 0 }
    },
    eternalLife: { ...createPeriodicTaskState(), deadline: Infinity, interval: 0 },
    activeShroud: '',
    activeShroudEntryId: null,
    activeShroudExitId: null,
    soulShardGrant: grantCharges(0, 0),
    carapaceExpiries: [],
    activeMinions: {},
    minionGenerations: {},
    minionAttackGenerations: {},
    minionAttackCursors: {},
    availableFlips: {},
    autoattackChains: {},
    swordChainGeneration: 0,
    selfConditions: [],
    plagueSendingArmed: false,
    lichEndsAt: 0,
    lichGeneration: 0,

    tasteForBloodGrants: {}
  };
  return state;
}
