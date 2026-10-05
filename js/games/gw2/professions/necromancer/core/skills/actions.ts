import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns synthetic Core Necromancer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the platform weapon-swap and Core shroud mechanic owners.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

const extraSkills: Skill[] = [
  createWeaponSwapSkill(),
  // Dodge uses the shared endurance controller and remains available in every transform.
  { ...createDodgeSkill({ cost: { resource: 'endurance' }, resourceCost: 50 }), usableInShroud: true },
  {
    id: ID.EXIT_LICH_FORM,
    // Manual and timed exits share the same guarded life-force reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-lich' } }],
    inputCategory: 'bar-swap', // Manual form exit replaces the active skill bar.
    name: 'Exit Lich Form',
    description: 'Leave Lich Form and return to your normal skill bar.',
    icon: 'https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png',
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    cooldown: 0,
    flipParentId: ID.LICH_FORM,
    flipParent: 'Lich Form',
    effects: []
  }
];

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const NECROMANCER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
