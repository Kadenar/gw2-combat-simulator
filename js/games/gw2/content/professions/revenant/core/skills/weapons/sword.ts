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
        coefficient: 3.9325,
        hits: 5,
        name: 'Unrelenting Assault',
        actorType: 'player',
        atMs: 104,
        intervalMs: 104,
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
        coefficient: 0.45,
        hits: 1,
        name: 'Initial Damage',
        actorType: 'player',
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.67,
        hits: 1,
        name: 'Final Damage',
        actorType: 'player',
        atMs: 600,
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
        coefficient: 1.2,
        hits: 1,
        name: 'Initial Damage',
        actorType: 'player',
        atMs: 640,
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
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 5,
        actorType: 'player',
        atMs: 640,
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
        coefficient: 0.9,
        hits: 1,
        name: 'Rift Slash — Packet 1',
        actorType: 'player',
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0.2175,
        hits: 1,
        name: 'Rift Damage',
        actorType: 'player',
        atMs: 1400,
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
        coefficient: 0.75,
        hits: 1,
        name: 'Preparation Thrust',
        actorType: 'player',
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player',
        atMs: 320,
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
        coefficient: 0.8,
        hits: 1,
        name: 'Chilling Isolation — Packet 1',
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Isolated Damage',
        actorType: 'player',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player',
        atMs: 280,
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
        coefficient: 0.8,
        hits: 1,
        name: 'Brutal Blade',
        actorType: 'player',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'player',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
