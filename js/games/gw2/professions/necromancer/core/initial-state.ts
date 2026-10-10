import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import {
  necromancerLifeForceCostMultiplier,
  type NecromancerCoreState
} from '#gw2/professions/necromancer/core/state.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { clamp } from '#kernel/core/numeric.js';

/** Creates fresh Core Necromancer resources, transforms, summons, and trait proc state from a build config. */
export function createNecromancerCoreState(
  config: NecromancerConfig,
  preparation: { attributes: Gw2Stats; balanceContext: ProfessionBalanceContext }
): NecromancerCoreState {
  // Seed every mutable subsystem independently and bound the initial life-force value.
  const state: NecromancerCoreState = {
    // Begin with two dodges; the shared controller advances regeneration and Vigor.
    endurance: createResourceClock(100),
    lifeForce: { value: clamp(config.initialResource ?? 100, 0, 100), maximum: 100, rate: 0, updatedAt: 0 },
    lifeForceCostMultiplier: necromancerLifeForceCostMultiplier(
      config,
      preparation.balanceContext,
      preparation.attributes.vitality ?? 1000
    ),
    lifeForceWakeGeneration: 0,
    passiveNextAt: {},
    activeShroud: '',
    activeShroudEntryId: null,
    activeShroudExitId: null,
    activeShroudProfileId: '',
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
