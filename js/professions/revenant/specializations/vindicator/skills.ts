/**
 * Vindicator skill mechanics owned by the Vindicator Revenant module.
 */
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import type { BalanceProfile, SkillFragment } from '../../../../platform/engine/types.js';

export const VINDICATOR_BALANCE_PROFILE_IDS = Object.freeze({
  spiritBoon: 'revenant.spirit-boon.alliance',
  songOfArboreum: TRAIT.SONG_OF_ARBOREUM,
  reaversCurse: TRAIT.REAVERS_CURSE,
  angsiyansTrust: TRAIT.ANGSIYANS_TRUST,
  forerunnerOfDeath: TRAIT.FORERUNNER_OF_DEATH
});

export const VINDICATOR_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SELFLESS_SPIRIT]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 10,
    ammo: 5,
    energyCost: 10,
    effects: [],
    legendId: 'LegendaryAlliance',
    allianceSide: 'kurzick'
  },
  [ID.URN_OF_SAINT_VIKTOR]: {
    implemented: true,
    handlerId: 'revenant.upkeep',
    castTimeMs: 0,
    cooldown: 2,
    energyCost: 0,
    upkeepCost: 5,
    pulseInterval: 1,
    effects: [],
    legendId: 'LegendaryAlliance',
    allianceSide: 'kurzick'
  },
  [ID.SAINTS_SHIELD]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.DEATH_DROP]: {
    implemented: true,
    castTimeMs: 200,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3.3,
        hits: 1,
        name: 'Death Drop',
        actorType: 'player',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.BATTLE_DANCE]: {
    implemented: true,
    castTimeMs: 250,
    cooldown: 3,
    energyCost: 15,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'kurzick'
  },
  [ID.SELFISH_SPIRIT]: {
    implemented: true,
    castTimeMs: 1500,
    cooldown: 10,
    ammo: 4,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.222,
        hits: 1,
        name: 'Selfish Spirit',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.ALLIANCE_TACTICS]: {
    implemented: true,
    handlerId: 'revenant.alliance-tactics',
    castTimeMs: 0,
    cooldown: 3,
    energyCost: 0,
    effects: []
  },
  [ID.DROP_URN_OF_SAINT_VIKTOR]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 1,
    energyCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 12,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Protection',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Resistance',
        duration: 4,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance'
  },
  [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ENERGY_MELD]: {
    implemented: true,
    handlerId: 'revenant.energy-meld',
    quicknessCastTimeMs: 440,
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    freeWithTraitId: TRAIT.ANGSIYANS_TRUST,
    effects: []
  },
  [ID.AWAKENING]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 10,
    energyCost: 15,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'kurzick'
  },
  [ID.NOMADS_ADVANCE]: {
    implemented: true,
    castTimeMs: 960,
    unaffectedByQuickness: true,
    cooldown: 3,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1,
        name: "Nomad's Advance",
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.IMPERIAL_IMPACT]: {
    implemented: true,
    castTimeMs: 200,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Imperial Impact',
        actorType: 'player',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.REAVERS_RAGE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 10,
    energyCost: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2.22,
        hits: 1,
        name: "Reaver's Rage",
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 1
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1.5
        }
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.TREE_SONG]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 3,
    energyCost: 15,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 8,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'kurzick'
  },
  [ID.SPEAR_OF_ARCHEMORUS]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 12,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 5,
        hits: 1,
        name: 'Spear of Archemorus',
        actorType: 'player',
        atMs: 2960,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 8,
        actorType: 'player',
        atMs: 2960,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.SCAVENGER_BURST]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 3,
    energyCost: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Scavenger Burst',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.ENERGY_MELD_ID_72058]: {
    implemented: true,
    handlerId: 'revenant.energy-meld',
    quicknessCastTimeMs: 440,
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    freeWithTraitId: TRAIT.ANGSIYANS_TRUST,
    effects: []
  },
  [ID.CALL_OF_THE_ALLIANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    resourceGain: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Alliance',
        actorType: 'player'
      }
    ]
  },
  [ID.LEGENDARY_ALLIANCE_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
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
        durationScale: 'fixed',
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
        durationScale: 'fixed',
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
]);
