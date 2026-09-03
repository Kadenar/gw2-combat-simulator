/** Owns Legendary Alliance stance skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const VINDICATOR_ALLIANCE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SELFLESS_SPIRIT]: {
    castTimeMs: 1500,
    cooldown: 10,
    ammo: 5,
    energyCost: 10,
    effects: [],
    legendId: 'LegendaryAlliance',
    allianceSide: 'kurzick'
  },
  [ID.URN_OF_SAINT_VIKTOR]: {
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
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
  [ID.BATTLE_DANCE]: {
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
  [ID.DROP_URN_OF_SAINT_VIKTOR]: {
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
  [ID.AWAKENING]: {
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
    castTimeMs: 960,
    unaffectedByQuickness: true,
    cooldown: 3,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 4 }],
        name: "Nomad's Advance",
        actorType: 'player',
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
  [ID.REAVERS_RAGE]: {
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
        controlKind: 'daze',
        duration: 1.5
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.TREE_SONG]: {
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
    quicknessCastTimeMs: 480,
    cooldown: 12,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 2960, coefficient: 5 }],
        name: 'Spear of Archemorus',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2960, condition: 'Torment', stacks: 5, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryAlliance',
    allianceSide: 'luxon'
  },
  [ID.SCAVENGER_BURST]: {
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
  }
});
