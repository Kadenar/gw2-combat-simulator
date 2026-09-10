/** Owns Legendary Alliance stance skill fragments. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const VINDICATOR_ALLIANCE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SELFISH_SPIRIT]: {
    castTimeMs: 1500,
    cooldown: 10,
    // Override the imported ammo fact: Selfish Spirit is one channel with a normal cooldown.
    ammo: 0,
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
    legendId: 'LegendaryAlliance'
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
    legendId: 'LegendaryAlliance'
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
    legendId: 'LegendaryAlliance'
  },
  [ID.SPEAR_OF_ARCHEMORUS]: {
    quicknessCastTimeMs: 480,
    interruptCommitMs: 400,
    cooldown: 12,
    energyCost: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 2960, coefficient: 5 }],
        name: 'Spear of Archemorus',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2960, condition: 'Torment', stacks: 5, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    legendId: 'LegendaryAlliance'
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
    legendId: 'LegendaryAlliance'
  }
});
