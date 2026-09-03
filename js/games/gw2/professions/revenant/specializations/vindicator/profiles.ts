/** Owns patchable Vindicator dodge and legend-invocation balance profiles. */
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { BalanceProfile } from '#gw2/platform/engine/types.js';

export const VINDICATOR_BALANCE_PROFILE_IDS = Object.freeze({
  spiritBoon: 'revenant.spirit-boon.alliance',
  songOfArboreum: TRAIT.SONG_OF_ARBOREUM,
  reaversCurse: TRAIT.REAVERS_CURSE,
  angsiyansTrust: TRAIT.ANGSIYANS_TRUST,
  forerunnerOfDeath: TRAIT.FORERUNNER_OF_DEATH
});

export const VINDICATOR_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: VINDICATOR_BALANCE_PROFILE_IDS.spiritBoon,
    name: 'Spirit Boon (Alliance)',
    profileKind: 'trait',
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 4,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    id: VINDICATOR_BALANCE_PROFILE_IDS.songOfArboreum,
    name: 'Song of Arboreum',
    profileKind: 'trait',
    resourceGain: 40,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 9,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    id: VINDICATOR_BALANCE_PROFILE_IDS.reaversCurse,
    name: "Reaver's Curse",
    profileKind: 'trait',
    rechargeMultiplier: 0.5,
    damageMultiplier: 2,
    effects: [
      {
        type: 'buff',
        kind: 'reavers-curse',
        duration: 6,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  {
    id: VINDICATOR_BALANCE_PROFILE_IDS.angsiyansTrust,
    name: "Angsiyan's Trust",
    profileKind: 'trait',
    resourceGain: 25,
    effects: []
  },
  {
    id: VINDICATOR_BALANCE_PROFILE_IDS.forerunnerOfDeath,
    name: 'Forerunner of Death',
    profileKind: 'trait',
    effects: [
      {
        type: 'buff',
        kind: 'forerunner-of-death',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
]);
