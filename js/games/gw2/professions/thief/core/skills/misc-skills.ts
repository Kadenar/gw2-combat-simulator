/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const THIEF_MISC_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LESSER_CALTROPS]: {
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 1, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Crippled', stacks: 1, duration: 1 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
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
