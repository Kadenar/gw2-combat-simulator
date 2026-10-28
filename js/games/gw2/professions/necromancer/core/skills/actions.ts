/**
 * Owns synthetic Core Necromancer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the platform weapon-swap and Core shroud mechanic owners.
 */
import { ACTOR } from '#gw2/platform/constants.js';
import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

const extraSkills: Skill[] = [
  // Consumed shards invoke this canonical payload without adding a player activation.
  {
    id: ID.SOUL_SHARDS,
    // The canonical siphon owns charge capacity and its target-health damage bonus.
    maximumStacks: 6,
    threshold: 0.5,
    damageMultiplier: 1.5,
    name: 'Soul Shards',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 1504,
        flatStrikePowerCoeff: 0.1,
        actorType: ACTOR.EFFECT,
        name: 'Soul Shards',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  createWeaponSwapSkill(),
  // Dodge uses the shared endurance controller and remains available in every transform.
  { ...createDodgeSkill(), usableInShroud: true },
  {
    name: 'Exit Lich Form',
    id: ID.EXIT_LICH_FORM,
    inputCategory: 'bar-swap', // Manual form exit replaces the active skill bar.
    description: 'Leave Lich Form and return to your normal skill bar.',
    icon: 'https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 0,
    flipParentId: ID.LICH_FORM,
    castTimeMs: 0,
    effects: [],
    // Manual and timed exits share the same guarded life-force reward.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.exit-lich' } }]
  }
];

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const NECROMANCER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
