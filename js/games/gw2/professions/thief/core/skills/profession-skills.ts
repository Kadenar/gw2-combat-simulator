/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
export const THIEF_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.STEAL]: {
    name: 'Steal',
    icon: 'https://render.guildwars2.com/file/A9ED689FE901E12467497F3FE79A04D300ADE3BB/103876.png',
    type: 'Profession',
    slot: 'Profession_1',
    stealTraitSkill: true,
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 25,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.steal' } }]
  },
  [ID.SOUL_STONE_VENOM]: {
    name: 'Soul Stone Venom',
    icon: new URL('@images/wiki/soul-stone-venom.png', import.meta.url).href,
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    // Commitment consumes the selected skill; Improvisation retains one use of the same choice.
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.1 }],
        name: 'Damage per Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.consume-stolen' } }]
  },
  [ID.DETONATE_PLASMA]: {
    name: 'Detonate Plasma',
    icon: new URL('@images/wiki/detonate-plasma.png', import.meta.url).href,
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    // Commitment consumes the selected skill; Improvisation retains one use of the same choice.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.2 }],
        name: 'Detonate Plasma',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 10
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESOLUTION,
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 3,
        stacks: 1
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.consume-stolen' } }]
  },
  [ID.THROW_MAGNETIC_BOMB]: {
    name: 'Throw Magnetic Bomb',
    icon: new URL('@images/wiki/throw-magnetic-bomb.png', import.meta.url).href,
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    // Commitment consumes the selected skill; Improvisation retains one use of the same choice.
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520].map((atMs) => ({
          atMs,
          coefficient: 6.3 / 3
        })),
        name: 'Throw Magnetic Bomb',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.PULL
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.consume-stolen' } }]
  }
};
