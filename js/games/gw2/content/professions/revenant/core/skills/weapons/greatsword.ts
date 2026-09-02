/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIST_SLASH]: {
    castTimeMs: 600,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.8 }],
        name: 'Mist Slash',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Vulnerability', stacks: 1, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIST_UNLEASHED]: {
    quicknessCastTimeMs: 520,
    cooldown: 3,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.6 }],
        name: 'Mist Unleashed',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.ARCING_MISTS]: {
    castTimeMs: 680,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1.2 }],
        name: 'Arcing Mists',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Chilled', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Vulnerability', stacks: 2, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TRUE_STRIKE]: {
    castTimeMs: 750,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'True Strike (vindicator) — Packet 1',
        actorType: 'player'
      }
    ]
  },
  [ID.PHANTOMS_ONSLAUGHT]: {
    quicknessCastTimeMs: 438,
    dashTimeMs: 38,
    hitDelayMs: 400,
    cooldown: 8,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: 420,
    energyCost: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: "Phantom's Onslaught",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.MIST_SWING]: {
    castTimeMs: 400,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Mist Swing',
        actorType: 'player'
      }
    ]
  },
  [ID.IMPERIAL_GUARD]: {
    castTimeMs: 2000,
    unaffectedByQuickness: true,
    defaultInterruptMs: 80,
    cooldown: 12,
    energyCost: 10,
    effects: []
  },
  [ID.ETERNITYS_REQUIEM]: {
    quicknessCastTimeMs: 840,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        name: "Eternity's Requiem",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        ticks: [
          // Median packet positions by hit rank across the supplied logs.
          // Individual uses vary from six to ten target hits.
          { atMs: 323, coefficient: 1 },
          { atMs: 401, coefficient: 0.9 },
          { atMs: 521, coefficient: 0.8 },
          { atMs: 605, coefficient: 0.7 },
          { atMs: 646, coefficient: 0.6 },
          { atMs: 722, coefficient: 0.5 },
          { atMs: 838, coefficient: 0.4 },
          { atMs: 922, coefficient: 0.3 },
          // Large targets overlap all nine random and five guaranteed impact areas.
          { atMs: 1002, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1082, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1162, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1242, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1322, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1402, coefficient: 0.3, metadata: { largeHitboxOnly: true } }
        ],
        metadata: {}
      }
    ]
  }
});
