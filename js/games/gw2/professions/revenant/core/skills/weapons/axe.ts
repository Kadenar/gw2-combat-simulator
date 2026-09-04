/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FRIGID_BLITZ]: {
    quicknessCastTimeMs: 681,
    cooldown: 10,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.15,
        hits: 1,
        name: 'Pass-Through Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Final Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.TEMPORAL_RIFT]: {
    quicknessCastTimeMs: 560,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 0.75 }],
        name: 'Temporal Rift',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Torment', stacks: 4, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        controlKind: 'pull',
        duration: 300
      }
    ]
  }
});
