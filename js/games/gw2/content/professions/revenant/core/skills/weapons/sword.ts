/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.UNRELENTING_ASSAULT]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 12,
    energyCost: 15,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 104 + index * 104, coefficient: 3.9325 / 5 })),
        name: 'Unrelenting Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.DEATHSTRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    cooldown: 15,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: 420,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.45 }],
        name: 'Initial Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.67 }],
        name: 'Final Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SHACKLING_WAVE]: {
    implemented: true,
    quicknessCastTimeMs: 800,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 1.2 }],
        name: 'Initial Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        name: 'Additional Strikes',
        actorType: 'player',
        ticks: [
          { atMs: 720, coefficient: 0.4 },
          { atMs: 800, coefficient: 0.4 },
          { atMs: 880, coefficient: 0.4 },
          { atMs: 960, coefficient: 0.4 },
          { atMs: 1040, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Immobilized', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Vulnerability', stacks: 8, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DEATHSTRIKE_ID_28625]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.67,
        hits: 1,
        name: 'Final Strike Damage',
        actorType: 'player'
      }
    ]
  },
  [ID.RIFT_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.9 }],
        name: 'Rift Slash — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1400, coefficient: 0.2175 }],
        name: 'Rift Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {}
      }
    ]
  },
  [ID.PREPARATION_THRUST]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.75 }],
        name: 'Preparation Thrust',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Vulnerability', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.CHILLING_ISOLATION]: {
    implemented: true,
    castTimeMs: 680,
    unaffectedByQuickness: true,
    paletteInterruptMs: 480,
    interruptCommitMs: 420,
    cooldown: 5,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        name: 'Chilling Isolation — Packet 1',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.6 }],
        name: 'Isolated Damage',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Chilled', stacks: 1, duration: 2 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BRUTAL_BLADE]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.8 }],
        name: 'Brutal Blade',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Vulnerability', stacks: 2, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
