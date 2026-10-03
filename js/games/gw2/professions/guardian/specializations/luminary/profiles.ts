import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const LUMINARY_BALANCE_PROFILE_IDS = Object.freeze({
  forge: 'guardian.luminary.radiant-forge',
  glaringBurstHammer: 'guardian.luminary.glaring-burst.hammer',
  glaringBurstBlade: 'guardian.luminary.glaring-burst.blade',
  glaringBurstStaff: 'guardian.luminary.glaring-burst.staff',
  glaringBurstBulwark: 'guardian.luminary.glaring-burst.bulwark',
  glaringBurstVulnerability: 'guardian.luminary.glaring-burst.vulnerability',
  radiantJusticeImpact: 'guardian.luminary.radiant-justice-impact',
  radiantCourageImmobilize: 'guardian.luminary.radiant-courage-immobilize',
  effulgentStance: 'guardian.luminary.effulgent-stance-detonation',
  lightAura: 'guardian.luminary.light-aura'
});

export const LUMINARY_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Radiant Courage adds two seconds of immobilize to the next Gleaming Blade impact (wiki: Radiant_Courage).
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.radiantCourageImmobilize,
    name: 'Radiant Courage - Gleaming Blade Immobilize',
    profileKind: 'skill-variant',
    parentId: ID.GLEAMING_BLADE,
    effects: [{ type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 }]
  },
  // Support weapons replace the strike with a party boon; every weapon applies the shared vulnerability afterward.
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.glaringBurstStaff,
    name: 'Glaring Burst — Radiant Staff',
    profileKind: 'skill-variant',
    parentId: ID.GLARING_BURST,
    effects: [
      { type: 'boon', name: 'regeneration', boon: 'regeneration', duration: 2, audience: { recipients: 'party' } }
    ]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.glaringBurstBulwark,
    name: 'Glaring Burst — Radiant Bulwark',
    profileKind: 'skill-variant',
    parentId: ID.GLARING_BURST,
    effects: [
      { type: 'boon', name: 'resolution', boon: 'resolution', duration: 1.5, audience: { recipients: 'party' } }
    ]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.glaringBurstVulnerability,
    name: 'Glaring Burst — Shared Vulnerability',
    profileKind: 'skill-variant',
    parentId: ID.GLARING_BURST,
    effects: [{ type: 'condition', name: 'Vulnerability', condition: 'Vulnerability', stacks: 1, duration: 8 }]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.forge,
    name: 'Radiant Forge',
    profileKind: 'mechanic',
    // Distinct weapons come from the weapon map; only duration and recharge reduction are tunable here.
    rechargeReduction: 5,
    effects: [
      {
        type: 'buff',
        name: 'radiant-forge',
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
    effects: [{ type: 'strike', name: 'Strike', coefficient: 1, hits: 1 }]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.glaringBurstBlade,
    name: 'Glaring Burst - Radiant Blade',
    profileKind: 'skill-variant',
    parentId: ID.GLARING_BURST,
    effects: [{ type: 'strike', name: 'Strike', coefficient: 1, hits: 1 }]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.radiantJusticeImpact,
    name: 'Dazzling Hammer - Radiant Justice Impact',
    profileKind: 'skill-variant',
    parentId: ID.DAZZLING_HAMMER,
    // Keep the empowered hammer's extra strike and Vulnerability on one delayed impact.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8
      }
    ])
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.effulgentStance,
    name: 'Effulgent Stance - Detonation',
    profileKind: 'skill-variant',
    parentId: ID.EFFULGENT_STANCE,
    maximumStacks: 10,
    damageIncreasePerStack: 0.35,
    effects: [
      { type: 'strike', name: 'Strike', coefficient: 0.5, hits: 1 },
      { type: 'control', name: 'Control' }
    ]
  },
  {
    id: LUMINARY_BALANCE_PROFILE_IDS.lightAura,
    name: 'Luminary Light Aura',
    profileKind: 'mechanic',
    effects: [{ type: 'buff', name: 'light-aura', kind: 'light-aura', stacks: 1, duration: 4 }]
  }
]);
