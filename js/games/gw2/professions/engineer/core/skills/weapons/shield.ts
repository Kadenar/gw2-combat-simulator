/** Canonical Core engineer skill definitions grouped by their GW2 owner. */
import { ACTOR, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer shield blocks and the palette follow-ups they arm and consume. */
export const ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.MAGNETIC_SHIELD]: {
    name: 'Magnetic Shield',
    description: 'Create a magnetic field that reflects projectiles and can be released to knock back foes.',
    icon: 'https://render.guildwars2.com/file/7F176FBD29DE3904651573F5161129AA5C4FD3D0/103473.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 2000,
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.MAGNETIC_INVERSION, durationSec: null } }]
  },
  [ID.MAGNETIC_INVERSION]: {
    name: 'Magnetic Inversion',
    description: 'Release the magnetic field to knock back nearby foes.',
    icon: 'https://render.guildwars2.com/file/BBD1A5F3730F423A037F42B10FFFACD2EF65C271/103483.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    cooldown: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Magnetic Inversion',
        actorType: ACTOR.PLAYER
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.MAGNETIC_INVERSION } }]
  },
  [ID.STATIC_SHIELD]: {
    name: 'Static Shield',
    description:
      'Electrify your shield, preparing to throw it at foes. Stun nearby enemies that attack you while blocking.',
    icon: 'https://render.guildwars2.com/file/133D50B114C9FDAE9D9DF0FBA5E82ABD0A610EE7/103474.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    cooldown: 24,
    castTimeMs: 1680,
    effects: [
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.STUN
      }
    ],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.THROW_SHIELD, durationSec: null } }]
  },
  [ID.THROW_SHIELD]: {
    name: 'Throw Shield',
    description: 'Throw your charged shield. Dazes foes it hits on the way out and back.',
    icon: 'https://render.guildwars2.com/file/7C3AA694D44340C00B76B414AC3168071AF292A0/103424.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    // Availability requires the parent skill's exposed window.

    requiresArmedFlip: true,
    cooldown: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Throw Shield',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.THROW_SHIELD } }]
  }
});
