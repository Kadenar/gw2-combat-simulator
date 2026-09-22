/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_MISC_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LESSER_CALTROPS]: {
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ])
  },
  [ID.LESSER_HASTE]: {
    castTimeMs: 0,
    cooldown: 60,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.BURST_OF_SHADOWS]: {
    castTimeMs: 0,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.5 }],
        name: 'Burst of Shadows',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  }
});
