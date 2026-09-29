import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { clamp } from '#kernel/core/numeric.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import {
  necromancerLifeForceCostMultiplier,
  type NecromancerCoreState
} from '#gw2/professions/necromancer/core/state.js';
import { necromancerCoreTraits } from '#gw2/professions/necromancer/core/traits/index.js';

/** Creates fresh Core Necromancer resources, transforms, summons, and trait proc state from a build config. */
export function createNecromancerCoreState(config: NecromancerConfig = {}): NecromancerCoreState {
  // Seed every mutable subsystem independently and bound the initial life-force value.
  const state: NecromancerCoreState = {
    lifeForce: { value: clamp(config.initialResource ?? 100, 0, 100), maximum: 100, rate: 0, updatedAt: 0 },
    lifeForceCostMultiplier: necromancerLifeForceCostMultiplier(config, {
      // Standalone state creation reads canonical base tuning; runtime initialization supplies active patches.
      balanceProfile: (id: string | number) => {
        const trait = necromancerCoreTraits.find((trait) => trait.id === id);
        return trait && { ...trait.balance, id: trait.id, name: trait.name };
      }
    }),
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
    targetChilledUntil: 0,
    dreadUntil: 0,

    tasteForBloodBuffs: {}
  };
  return state;
}
