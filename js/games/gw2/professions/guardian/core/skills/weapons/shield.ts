/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SHIELD_OF_JUDGMENT]: {
    name: 'Shield of Judgment',
    description:
      'Create a shielding wave in front of you that damages foes while giving protection and aegis to you and up to five allies.',
    icon: 'https://render.guildwars2.com/file/5B2FE8C77DC2B00E75415AF578E5C550DE9B0CB5/103232.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SHIELD_OF_ABSORPTION]: {
    name: 'Shield of Absorption',
    description: 'Create a dome around you that pushes foes back and absorbs projectiles.',
    icon: 'https://render.guildwars2.com/file/BC380F0749013D4B5272B8599A510D0099F945BB/103026.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    cooldown: 24,
    // Detonation stays available while the dome lasts.
    flipDuration: 4,
    castTimeMs: 520,
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.SHIELD_OF_ABSORPTION_ID_DETONATE, expiryPriority: -220 } }
    ]
  },
  [ID.SHIELD_OF_ABSORPTION_ID_DETONATE]: {
    name: 'Shield of Absorption',
    description: 'Detonate the dome to heal nearby allies.',
    icon: 'https://render.guildwars2.com/file/299DDE0F181A754CDF396D6A5FA735080361EF46/103704.png',
    type: 'Weapon',
    weapon: 'Shield',
    slot: 'Weapon_5',
    cooldown: 0,
    castTimeMs: 520,
    effects: [],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SHIELD_OF_ABSORPTION_ID_DETONATE } }]
  }
});
