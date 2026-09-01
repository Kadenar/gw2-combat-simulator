import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/state/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { hasSelectedSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import type { SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianState
} from '#gw2/content/professions/guardian/types.js';
import {
  guardianBuildAvailability,
  guardianCastAvailability
} from '#gw2/content/professions/guardian/core/mechanics/availability.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/core/profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

type GuardianRechargeModifierContext = GuardianSchedulerContext &
  SchedulerRecord & {
    readonly skill?: GuardianSkill;
  };

type GuardianAmmoModifierContext = GuardianSchedulerContext &
  SchedulerRecord & {
    readonly skill?: GuardianSkill;
  };

export function guardianRuntimeState(context: Gw2ModifierContext): Partial<GuardianState> {
  return readProfessionCoreState<GuardianState>(context.runtime?.profession);
}

function activeWeapon(context: Gw2ModifierContext): string | undefined {
  const eventWeapon = context.event?.skillWeapon;
  if (typeof eventWeapon === 'string') return eventWeapon;
  const weaponSet = context.timeline?.activeWeaponSetAt(context.time) || 1;
  return gw2PrimaryWeapon(context.config, weaponSet);
}

function isOneHandedWeapon(weapon: string | undefined): boolean {
  return (
    typeof weapon === 'string' && !['Greatsword', 'Hammer', 'Longbow', 'Short Bow', 'Spear', 'Staff'].includes(weapon)
  );
}

export function guardianBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  if (boon === 'resolution' && Number(guardianRuntimeState(context).resolutionUntil || 0) > context.time) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time
  );
}

export function guardianTimedBuffActive(context: Gw2ModifierContext, kind: string): boolean {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

export function latestGuardianTimedBuff(context: Gw2ModifierContext, kind: string): SimulationEvent | null {
  let latest: SimulationEvent | null = null;
  for (const event of context.events || []) {
    if (event.at > context.time) break;
    if (event.type === 'buff' && event.kind === kind) latest = event;
  }

  return latest;
}

export function guardianTargetDisabled(context: Gw2ModifierContext): boolean {
  if (context.config?.target?.disabled || context.config?.target?.defiant || context.config?.target?.defianceBroken)
    return true;
  return (context.events || []).some(
    (event) =>
      event.type === 'control' &&
      event.at <= context.time &&
      event.at + Math.max(0, Number(event.duration || 0)) > context.time
  );
}

export const guardianCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.zealous-blade-power',
    label: 'Zealous Blade',
    target: MODIFIER_TARGET.ATTRIBUTE_POWER,
    operation: 'add',
    parameters: { baseBonus: 120, greatswordBonus: 120 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => {
      const provenance = attributeProvenance(context.config);
      const currentWeapon = activeWeapon(context);
      return provenance.professionStaticRulesApplied
        ? (Number(currentWeapon === 'Greatsword') - Number(provenance.calculatedPrimaryWeapon === 'Greatsword')) *
            parameters.greatswordBonus
        : parameters.baseBonus + Number(currentWeapon === 'Greatsword') * parameters.greatswordBonus;
    },
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)
  },
  {
    id: 'guardian.right-hand-strength-precision',
    label: 'Right-Hand Strength',
    target: MODIFIER_TARGET.ATTRIBUTE_PRECISION,
    operation: 'add',
    parameters: { attributeBonus: 80 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      attributeProvenance(context.config).professionStaticRulesApplied ? 0 : parameters.attributeBonus,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH)
  },
  {
    id: 'guardian.right-hand-strength-power',
    label: 'Right-Hand Strength',
    target: MODIFIER_TARGET.ATTRIBUTE_POWER,
    operation: 'add',
    parameters: { attributeBonus: 80 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => {
      const provenance = attributeProvenance(context.config);
      const currentWeapon = activeWeapon(context);
      return provenance.professionStaticRulesApplied
        ? (Number(isOneHandedWeapon(currentWeapon)) - Number(isOneHandedWeapon(provenance.calculatedPrimaryWeapon))) *
            parameters.attributeBonus
        : Number(isOneHandedWeapon(currentWeapon)) * parameters.attributeBonus;
    },
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH)
  },
  {
    id: 'guardian.radiant-power-ferocity',
    label: 'Radiant Power',
    target: MODIFIER_TARGET.ATTRIBUTE_FEROCITY,
    operation: 'add',
    parameters: { attributeBonus: 150 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      attributeProvenance(context.config).professionStaticRulesApplied ? 0 : parameters.attributeBonus,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)
  },
  {
    id: 'guardian.power-of-the-virtuous-condition-damage',
    label: 'Power of the Virtuous',
    target: MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
    operation: 'add',
    parameters: { vitalityConversion: 0.07 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      attributeProvenance(context.config).professionStaticRulesApplied
        ? 0
        : Number(context.config?.stats?.vitality || 0) * parameters.vitalityConversion,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  },
  {
    id: 'guardian.signet-of-wrath-condition-damage',
    label: 'Signet of Wrath',
    target: MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
    operation: 'add',
    parameters: {
      attributeBonus: 180,
      perfectInscriptionsMultiplier: 1.2
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => {
      const perfectInscriptions = hasTrait(context, GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS);
      const passiveActive =
        perfectInscriptions || !context.timeline?.skillOnCooldownAt(GUARDIAN_SKILL_IDS.SIGNET_OF_WRATH, context.time);
      const amount = parameters.attributeBonus * (perfectInscriptions ? parameters.perfectInscriptionsMultiplier : 1);
      return attributeProvenance(context.config).professionStaticRulesApplied
        ? passiveActive
          ? 0
          : -amount
        : passiveActive
          ? amount
          : 0;
    },
    when: (context) => hasSelectedSkill(context, 'Signet of Wrath')
  },
  {
    id: 'guardian.inspired-virtue',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { damagePerBoon: 0.005 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      GW2_STANDARD_BOONS.filter((boon) => guardianBoonActive(context, boon)).length * parameters.damagePerBoon,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)
  },
  {
    id: 'guardian.unscathed-contender-health',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER)
  },
  {
    id: 'guardian.unscathed-contender-aegis',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER) && guardianBoonActive(context, 'aegis')
  },
  {
    id: 'guardian.inspiring-virtue',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE) &&
      guardianTimedBuffActive(context, 'guardian-inspiring-virtue')
  },
  {
    id: 'guardian.radiant-power-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.1,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER) && targetConditionActive(context, 'Burning')
  },
  {
    id: 'guardian.righteous-instincts',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.25,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) && guardianBoonActive(context, 'resolution')
  },
  {
    id: 'guardian.retribution',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RETRIBUTION) && guardianBoonActive(context, 'resolution')
  },
  {
    id: 'guardian.furious-focus',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS) &&
      Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  },
  {
    id: 'guardian.symbolic-avenger',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 5,
      damagePerStack: 0.01
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      Math.min(parameters.maximumStacks, Number(guardianRuntimeState(context).symbolicAvengerStacks || 0)) *
      parameters.damagePerStack,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER) &&
      Number(guardianRuntimeState(context).symbolicAvengerUntil || 0) > context.time
  },
  {
    id: 'guardian.fiery-wrath',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    order: 100,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.FIERY_WRATH) && targetConditionActive(context, 'Burning')
  },
  {
    id: 'guardian.symbolic-exposure',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE) && targetConditionActive(context, 'Vulnerability')
  },
  {
    id: 'guardian.amplified-wrath-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) => context.condition === 'Burning' && hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH)
  },
  {
    id: 'guardian.radiant-fire-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.2,
    // Specific condition-duration bonuses add to Expertise and are skipped when panel stats already include them.
    when: (context) =>
      context.condition === 'Burning' &&
      hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE) &&
      !attributeProvenance(context.config).professionStaticRulesApplied
  }
]);

export function compileGuardianModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

function modifyGuardianRechargeDuration(context: GuardianRechargeModifierContext, duration: number): number {
  const skill = context.skill;
  let result = duration;
  if (skill?.weapon === 'Greatsword' && hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)) {
    result *= Number(balanceProfileFromContext(context, PROFILE.zealousBlade)?.rechargeMultiplier || 0.8);
  }

  if (skill?.weapon === 'Torch' && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    result *= Number(balanceProfileFromContext(context, PROFILE.radiantFire)?.rechargeMultiplier || 0.8);
  }

  if (skill?.weapon === 'Focus' && hasTrait(context, GUARDIAN_TRAIT_IDS.FOCUS_MASTERY)) {
    result *= Number(balanceProfileFromContext(context, PROFILE.focusMastery)?.rechargeMultiplier || 0.8);
  }

  if (
    skill?.categories?.includes('Virtue') &&
    /^Profession_[1-3]$/.test(String(skill.slot || '')) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  ) {
    result *= Number(balanceProfileFromContext(context, PROFILE.powerOfTheVirtuous)?.rechargeMultiplier || 0.85);
  }

  return result;
}

function modifyGuardianMaximumAmmo(context: GuardianAmmoModifierContext, maximum: number): number {
  let result = maximum;
  if (context.skill?.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    result = Math.max(result, Number(balanceProfileFromContext(context, PROFILE.radiantFire)?.maximumStacks || 2));
  }

  if (context.skill?.categories?.includes('SpiritWeapon') && hasTrait(context, GUARDIAN_TRAIT_IDS.ETERNAL_ARMORY)) {
    result += Number(balanceProfileFromContext(context, PROFILE.eternalArmory)?.resourceGain || 1);
  }

  return result;
}

// Apply Guardian's Burning-specific skill and trait multipliers before general
// condition-duration scaling.
function modifyGuardianConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  if (context.condition !== 'Burning') return duration;
  let result = duration;
  if (
    (context.sourceId === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME ||
      context.event?.skillId === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)
  ) {
    result *= Number(balanceProfileFromContext(context, PROFILE.radiantFire)?.durationMultiplier || 1.5);
  }

  if (
    (context.sourceId === 'guardian.justice-passive' || context.event?.sourceId === 'guardian.justice-passive') &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH)
  ) {
    result *= Number(balanceProfileFromContext(context, PROFILE.amplifiedWrath)?.durationMultiplier || 1.2);
  }

  return result;
}

export const guardianCoreAttributeRules = Object.freeze({
  modifyConditionBaseDuration: modifyGuardianConditionBaseDuration,
  modifierRules: guardianCoreModifierRules,
  compileModifierRules: compileGuardianModifierRules
});

export const guardianCoreCastRules = Object.freeze({
  availability: Object.freeze([
    {
      id: 'guardian.cast-state',
      order: 10,
      handler: guardianCastAvailability
    },
    {
      id: 'guardian.build',
      order: 100,
      handler: guardianBuildAvailability
    }
  ]),
  modifyRechargeDuration: modifyGuardianRechargeDuration,
  modifyMaximumAmmo: modifyGuardianMaximumAmmo
});
