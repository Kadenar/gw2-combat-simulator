/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
export const THIEF_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.STEAL]: {
    stealTraitSkill: true,
    movementSkill: true,
    // Custom: Runs steal traits, grants a stored stolen skill, and updates steal state; see `core/mechanics/steal.ts`.
    handlerId: 'thief.steal',
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
    // Consume the selected stolen skill after its effects; Improvisation retains one use of the same choice.
    handlerId: 'thief.stolen-skill',
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.1 }],
        name: 'Damage per Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.DETONATE_PLASMA]: {
    // Consume the selected stolen skill after its effects; Improvisation retains one use of the same choice.
    handlerId: 'thief.stolen-skill',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.2 }],
        name: 'Detonate Plasma',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Vigor',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 10,
        stacks: 10
      },
      {
        type: 'boon',
        boon: 'Fury',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Aegis',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Stability',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'Resistance',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.THROW_MAGNETIC_BOMB]: {
    // Consume the selected stolen skill after its effects; Improvisation retains one use of the same choice.
    handlerId: 'thief.stolen-skill',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520].map((atMs) => ({
          atMs,
          coefficient: 6.300000000000001 / 3
        })),
        name: 'Throw Magnetic Bomb',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull',
        duration: 360
      }
    ]
  }
});
