import { ACTOR } from '#gw2/platform/constants.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

/** Shared actor startup and the multi-action Painful Bond retain mechanic ownership. */
export const RITUALIST_BALANCE_PROFILE_IDS = Object.freeze({
  spiritCadence: 'necromancer.ritualist.spirit-cadence',
  painfulBond: 'necromancer.ritualist.painful-bond'
});

export const RITUALIST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.spiritCadence,
    name: 'Ritualist Spirit Cadence',
    profileKind: 'mechanic',
    initialDelay: 7.36,
    resummonedSpiritAttackDelayMs: 4140,
    weaponStrength: 1056,
    effects: []
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.painfulBond,
    name: 'Painful Bond',
    profileKind: 'mechanic',
    pulseInterval: 1,
    // Retain the original 4 ms pulse offset pending verification; its gameplay rationale is undocumented.
    initialDelay: 0.004,
    icon: 'https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png',
    effects: [
      {
        name: 'necromancer-painful-bond',
        type: 'buff',
        kind: 'necromancer-painful-bond',
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 200,
        flatStrikePowerCoeff: 0.4,
        actorType: ACTOR.EFFECT,
        canCrit: false
      }
    ]
  }
]);
