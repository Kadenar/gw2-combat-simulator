import { ACTOR, RECIPIENT, CONTROL, BOON } from '#gw2/platform/constants.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
export const THIEF_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.STEAL]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.steal' } }],
    stealTraitSkill: true,
    movementSkill: true,

    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.STEAL_ID_13109]: {
    movementSkill: true,
    castTimeMs: 0,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.SOUL_STONE_VENOM]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.consume-stolen' } }],
    // Commitment consumes the selected skill; Improvisation retains one use of the same choice.
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.1 }],
        name: 'Damage per Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DETONATE_PLASMA]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.consume-stolen' } }],
    // Commitment consumes the selected skill; Improvisation retains one use of the same choice.
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
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
    ]
  },
  [ID.THROW_MAGNETIC_BOMB]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.consume-stolen' } }],
    // Commitment consumes the selected skill; Improvisation retains one use of the same choice.
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
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
    ]
  }
});
