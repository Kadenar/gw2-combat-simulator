import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

export const LUMINARY_BALANCE_PROFILE_IDS = Object.freeze({
  forge: 'guardian.luminary.radiant-forge',
  glaringBurstHammer: 'guardian.luminary.glaring-burst.hammer',
  glaringBurstBlade: 'guardian.luminary.glaring-burst.blade',
  radiantJusticeImpact: 'guardian.luminary.radiant-justice-impact',
  effulgentStance: 'guardian.luminary.effulgent-stance-detonation',
  lightAura: 'guardian.luminary.light-aura',
  sovereignOfLight: TRAIT.SOVEREIGN_OF_LIGHT,
  radiantArmaments: TRAIT.RADIANT_ARMAMENTS,
  empoweredArmaments: TRAIT.EMPOWERED_ARMAMENTS,
  illuminatingInspiration: TRAIT.ILLUMINATING_INSPIRATION,
  justiceIsBlind: TRAIT.JUSTICE_IS_BLIND
});

export const LUMINARY_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.forge,
    name: 'Radiant Forge',
    profileKind: 'mechanic',
    maximumStacks: 4,
    rechargeReduction: 5,
    threshold: 5,
    effects: [
      {
        type: 'buff',
        kind: 'radiant-forge',
        stacks: 1,
        duration: 20
      }
    ]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.glaringBurstHammer,
    name: 'Glaring Burst - Radiant Hammer',
    profileKind: 'skill-variant',
    parentId: ID.GLARING_BURST,
    effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.glaringBurstBlade,
    name: 'Glaring Burst - Radiant Blade',
    profileKind: 'skill-variant',
    parentId: ID.GLARING_BURST,
    effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.radiantJusticeImpact,
    name: 'Dazzling Hammer - Radiant Justice Impact',
    profileKind: 'skill-variant',
    parentId: ID.DAZZLING_HAMMER,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 750,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        atMs: 750,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.effulgentStance,
    name: 'Effulgent Stance - Detonation',
    profileKind: 'skill-variant',
    parentId: ID.EFFULGENT_STANCE,
    maximumStacks: 10,
    damageIncreasePerStack: 0.35,
    effects: [
      { type: 'strike', coefficient: 0.5, hits: 1 },
      { type: 'control', duration: 2 }
    ]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.lightAura,
    name: 'Luminary Light Aura',
    profileKind: 'mechanic',
    effects: [{ type: 'buff', kind: 'light-aura', stacks: 1, duration: 4 }]
  },
  trait(LUMINARY_BALANCE_PROFILE_IDS.sovereignOfLight, 'Sovereign of Light', {
    effects: [{ type: 'strike', coefficient: 1.5, hits: 1 }]
  }),
  trait(LUMINARY_BALANCE_PROFILE_IDS.radiantArmaments, 'Radiant Armaments', {
    effects: [{ type: 'buff', kind: 'radiant-armaments', duration: 10 }]
  }),
  trait(LUMINARY_BALANCE_PROFILE_IDS.empoweredArmaments, 'Empowered Armaments', {
    maximumStacks: 20,
    resourceGain: 6
  }),
  trait(LUMINARY_BALANCE_PROFILE_IDS.illuminatingInspiration, 'Illuminating Inspiration', { rechargeReduction: 4 }),
  trait(LUMINARY_BALANCE_PROFILE_IDS.justiceIsBlind, 'Justice is Blind', {
    effects: [{ type: 'blind', duration: 3 }]
  })
]);
