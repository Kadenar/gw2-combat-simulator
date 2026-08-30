/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FRIGID_BLITZ]: {
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Temporal Rift',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 10,
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 640,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'pull',
          duration: 300
        }
      }
    ]
  }
});
