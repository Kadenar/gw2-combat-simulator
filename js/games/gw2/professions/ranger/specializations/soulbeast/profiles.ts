import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const SOULBEAST_BALANCE_PROFILE_IDS = Object.freeze({
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
