/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_MISC_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.LESSER_CALTROPS]: {
    name: 'Lesser Caltrops',
    description: 'Scatter caltrops that cripple and bleed foes.',
    icon: 'https://render.guildwars2.com/file/A85F59D91114D0702C3AB54A0AA81EC1CAE66CF5/103073.png',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    type: 'Proc',
    slot: 'Action',
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 0,
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
        actorType: ACTOR.PLAYER
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
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.LESSER_HASTE]: {
    name: 'Lesser Haste',
    description: 'Gain quickness, fury, and swiftness.',
    icon: 'https://render.guildwars2.com/file/1C7719C3046D06161D071C0A6B33D3C8179E3F67/103459.png',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    type: 'Proc',
    slot: 'Action',

    cooldown: 60,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 6,
        stacks: 1,
        audience: { recipients: RECIPIENT.SELF }
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6,
        stacks: 1,
        audience: { recipients: RECIPIENT.SELF }
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1,
        audience: { recipients: RECIPIENT.SELF }
      }
    ]
  },
  [ID.BURST_OF_SHADOWS]: {
    name: 'Burst of Shadows',
    description: "Invoke an explosion of shadows at your marked target's location that blinds nearby foes.",
    icon: 'https://render.guildwars2.com/file/007CF2CAA795DC259DD538C0CB7D9C36FE3AE423/1770636.png',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    type: 'Action',
    slot: 'Action',
    patchAuthoringExcluded: true,
    cooldown: 1,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.5 }],
        name: 'Burst of Shadows',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ]
  }
});
