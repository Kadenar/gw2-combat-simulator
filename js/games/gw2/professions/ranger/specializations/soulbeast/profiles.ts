import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_BALANCE_PROFILE_IDS = Object.freeze({
  oneWolfPack: 'ranger.soulbeast.one-wolf-pack',
  vultureStance: 'ranger.soulbeast.vulture-stance',
  wintersBite: 'ranger.soulbeast.winters-bite',

  stoutArchetype: 'ranger.soulbeast.archetype.stout',
  deadlyArchetype: 'ranger.soulbeast.archetype.deadly',
  versatileArchetype: 'ranger.soulbeast.archetype.versatile',
  ferociousArchetype: 'ranger.soulbeast.archetype.ferocious',
  supportiveArchetype: 'ranger.soulbeast.archetype.supportive'
});

const archetype = (id: string, name: string, fields: Readonly<Record<string, number>>): BalanceProfile => ({
  id,
  name: `Soulbeast ${name} Archetype`,
  profileKind: 'mechanic',
  effects: [],
  ...fields
});

export const SOULBEAST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack,
    parentId: ID.ONE_WOLF_PACK,
    name: 'One Wolf Pack - Echo',
    profileKind: 'skill-variant',
    durationMultiplier: 6,
    internalCooldown: 1,
    initialDelay: 0.28,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 0.95, hits: 1 }]
  },
  {
    id: SOULBEAST_BALANCE_PROFILE_IDS.vultureStance,
    parentId: ID.VULTURE_STANCE,
    name: 'Vulture Stance - Triggered Effects',
    profileKind: 'skill-variant',
    durationMultiplier: 6,
    internalCooldown: 0.25,
    effects: [
      { name: 'Poisoned', type: 'condition', condition: 'Poisoned', duration: 4, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 4, stacks: 1 }
    ]
  },
  {
    id: SOULBEAST_BALANCE_PROFILE_IDS.wintersBite,
    parentId: ID.WINTERS_BITE,
    name: "Winter's Bite - Beastmode Trigger",
    profileKind: 'skill-variant',
    effects: [{ name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 10, stacks: 1 }]
  },
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.stoutArchetype, 'Stout', {
    attributeBonus: 200,
    weaponAttributeBonus: 100
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.deadlyArchetype, 'Deadly', {
    attributeBonus: 150,
    weaponAttributeBonus: 100
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.versatileArchetype, 'Versatile', {
    attributeBonus: 200,
    weaponAttributeBonus: 225
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.ferociousArchetype, 'Ferocious', {
    attributeBonus: 150,
    weaponAttributeBonus: 100
  }),
  archetype(SOULBEAST_BALANCE_PROFILE_IDS.supportiveArchetype, 'Supportive', {
    attributeBonus: 100
  })
]);
