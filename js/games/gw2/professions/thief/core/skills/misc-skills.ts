import { BOON } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_MISC_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LESSER_CALTROPS]: {
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    // Three one-second pulses retain their own condition durations and patchable payloads.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        name: CONDITION.BLEEDING,
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 5,
        applications: 3,
        atMs: 800,
        intervalMs: 1000,
        actorType: 'player'
      },
      {
        type: 'condition',
        name: CONDITION.CRIPPLED,
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1,
        applications: 3,
        atMs: 800,
        intervalMs: 1000,
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
        boon: BOON.QUICKNESS,
        duration: 6,
        stacks: 1,
        audience: { recipients: 'self' }
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6,
        stacks: 1,
        audience: { recipients: 'self' }
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1,
        audience: { recipients: 'self' }
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
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  }
});
