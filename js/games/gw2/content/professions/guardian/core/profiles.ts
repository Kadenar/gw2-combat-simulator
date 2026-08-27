import type { BalanceProfile, SkillEffect, SkillId } from '../../../../platform/engine/types.js';
import { defineTraitProfile as trait } from '../../../../integrations/patches/authoring/balance-profiles.js';
import { balanceProfileEffect, balanceProfileFromContext } from '../../../../platform/combat/state/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '../data/ids.js';

export const GUARDIAN_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  justice: 'guardian.core.justice',
  permeatingWrath: TRAIT.PERMEATING_WRATH,
  spearHelioRush: 'guardian.core.spear.helio-rush-illuminated',
  spearGleamingDisc: 'guardian.core.spear.gleaming-disc-illuminated',
  spearSolarStorm: 'guardian.core.spear.solar-storm-illuminated',
  spearLuminance: 'guardian.core.spear.symbol-of-luminance',
  inspiredVirtue: TRAIT.INSPIRED_VIRTUE,
  virtueOfResolution: TRAIT.VIRTUE_OF_RESOLUTION,
  inspiringVirtue: TRAIT.INSPIRING_VIRTUE,
  indomitableCourage: TRAIT.INDOMITABLE_COURAGE,
  furiousFocus: TRAIT.FURIOUS_FOCUS,
  masterOfConsecrations: TRAIT.MASTER_OF_CONSECRATIONS,
  writOfPersistence: TRAIT.WRIT_OF_PERSISTENCE,
  symbolOfIgnition: 'guardian.core.symbol-of-ignition-field',
  symbolicExposure: TRAIT.SYMBOLIC_EXPOSURE,
  symbolicAvenger: TRAIT.SYMBOLIC_AVENGER,
  zealotsResolution: TRAIT.ZEALOTS_RESOLUTION,
  righteousInstincts: TRAIT.RIGHTEOUS_INSTINCTS,
  zealousBlade: TRAIT.ZEALOUS_BLADE,
  rightHandStrength: TRAIT.RIGHT_HAND_STRENGTH,
  radiantPower: TRAIT.RADIANT_POWER,
  powerOfTheVirtuous: TRAIT.POWER_OF_THE_VIRTUOUS,
  signetOfWrath: 'guardian.core.signet-of-wrath-passive',
  radiantFire: TRAIT.RADIANT_FIRE,
  focusMastery: TRAIT.FOCUS_MASTERY,
  amplifiedWrath: TRAIT.AMPLIFIED_WRATH,
  eternalArmory: TRAIT.ETERNAL_ARMORY
});

export const GUARDIAN_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice,
    name: 'Virtue of Justice',
    profileKind: 'mechanic',
    threshold: 5,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player',
        packetLabel: 'active'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1.2,
        actorType: 'player',
        packetLabel: 'passive'
      }
    ]
  },
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.permeatingWrath, 'Permeating Wrath', { threshold: 3 }),
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearHelioRush,
    name: 'Helio Rush - Illuminated',
    profileKind: 'skill-variant',
    parentId: ID.HELIO_RUSH,
    damageMultiplier: 1.5,
    effects: []
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearGleamingDisc,
    name: 'Gleaming Disc - Illuminated',
    profileKind: 'skill-variant',
    parentId: ID.GLEAMING_DISC,
    damageMultiplier: 1.25,
    effects: []
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearSolarStorm,
    name: 'Solar Storm - Illuminated',
    profileKind: 'skill-variant',
    parentId: ID.SOLAR_STORM,
    damageMultiplier: 1.25,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        atMs: 1160,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        atMs: 1360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearLuminance,
    name: 'Symbol of Luminance - Illumination',
    profileKind: 'skill-variant',
    parentId: ID.SYMBOL_OF_LUMINANCE,
    effects: [
      {
        type: 'buff',
        kind: 'guardian-spear-luminance',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.inspiredVirtue, 'Inspired Virtue', {
    effects: [
      { type: 'boon', boon: 'might', stacks: 3, duration: 5 },
      { type: 'boon', boon: 'regeneration', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'protection', stacks: 1, duration: 5 }
    ]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.virtueOfResolution, 'Virtue of Resolution', {
    durationMultiplier: 1.25,
    effects: [{ type: 'boon', boon: 'resolution', stacks: 1, duration: 3 }]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.inspiringVirtue, 'Inspiring Virtue', {
    effects: [
      {
        type: 'buff',
        kind: 'guardian-inspiring-virtue',
        stacks: 1,
        duration: 6
      }
    ]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.indomitableCourage, 'Indomitable Courage', {
    pulseInterval: 30,
    effects: [{ type: 'boon', boon: 'stability', stacks: 3, duration: 4 }]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.furiousFocus, 'Furious Focus', {
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 3.25,
        hits: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.masterOfConsecrations, 'Master of Consecrations', {
    durationMultiplier: 1.4,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 2,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        applications: 2,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.writOfPersistence, 'Writ of Persistence', {
    effects: [
      {
        type: 'strike',
        // Writ adds four more spatial Smite packets during its two-second symbol extension.
        ticks: [4240, 4760, 5240, 5760].map((atMs) => ({ atMs, coefficient: 0.2 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [5240, 6240].map((atMs) => ({ atMs, coefficient: 0.5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 4,
        duration: 5,
        applications: 2,
        atMs: 5240,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'buff',
        name: 'symbol-duration-extension',
        duration: 2,
        actorType: 'player'
      }
    ]
  }),
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.symbolOfIgnition,
    name: 'Symbol of Ignition - Field',
    profileKind: 'skill-variant',
    parentId: ID.SYMBOL_OF_IGNITION,
    internalCooldown: 0.25,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'guardian-symbol-of-ignition-field',
        stacks: 1,
        duration: 4,
        actorType: 'effect'
      }
    ]
  },
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.symbolicExposure, 'Symbolic Exposure', {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.symbolicAvenger, 'Symbolic Avenger', { maximumStacks: 5, pulseInterval: 15 }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.zealotsResolution, "Zealot's Resolution", {
    cooldown: 30,
    threshold: 0.25,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'resolution',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.righteousInstincts, 'Righteous Instincts', {
    pulseInterval: 1,
    effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 6 }]
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.zealousBlade, 'Zealous Blade', {
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.rightHandStrength, 'Right-Hand Strength', { attributeBonus: 80 }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.radiantPower, 'Radiant Power', {
    attributeBonus: 150
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.powerOfTheVirtuous, 'Power of the Virtuous', {
    attributeConversion: 0.07,
    rechargeMultiplier: 0.85
  }),
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.signetOfWrath,
    name: 'Signet of Wrath - Passive',
    profileKind: 'skill-variant',
    parentId: ID.SIGNET_OF_WRATH,
    attributeBonus: 180,
    damageMultiplier: 1.2,
    effects: []
  },
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.radiantFire, 'Radiant Fire', {
    rechargeMultiplier: 0.8,
    durationMultiplier: 1.5,
    maximumStacks: 2
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.focusMastery, 'Focus Mastery', {
    rechargeMultiplier: 0.8
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.amplifiedWrath, 'Amplified Wrath', {
    durationMultiplier: 1.2
  }),
  trait(GUARDIAN_CORE_BALANCE_PROFILE_IDS.eternalArmory, 'Eternal Armory', {
    resourceGain: 1
  })
]);

export function guardianBalanceProfile(context: unknown, id: SkillId): BalanceProfile | undefined {
  return balanceProfileFromContext(context, id);
}

export function guardianBalanceProfileEffect(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: string,
  index = 0
): SkillEffect | undefined {
  return balanceProfileEffect(profile, type, index);
}
