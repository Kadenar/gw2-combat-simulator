import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { attributeProvenance } from '#gw2/platform/builds/attribute-provenance.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { boonActive, hasSelectedSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { GuardianSchedulerContext, GuardianSkill, GuardianState } from '#gw2/professions/guardian/types.js';
import {
  guardianBuildAvailability,
  guardianCastAvailability
} from '#gw2/professions/guardian/core/mechanics/availability.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { activeSymbolicAvengerExpirations } from '#gw2/professions/guardian/core/state.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

/** Supplies the same skill and scheduler state to recharge and ammo trait rules. */
type GuardianSkillModifierContext = GuardianSchedulerContext & {
  readonly skill?: GuardianSkill;
};

function guardianRuntimeState(context: Gw2ModifierContext): Partial<GuardianState> {
  return readProfessionCoreState<GuardianState>(context.runtime?.profession);
}

function activeWeapon(context: Gw2ModifierContext): string | undefined {
  // Equipped-weapon traits follow swaps at impact time, including delayed attacks from the previous weapon.
  const weaponSet = context.timeline?.activeWeaponSetAt(context.time) || 1;
  return gw2PrimaryWeapon(context.config, weaponSet);
}

function isOneHandedWeapon(weapon: string | undefined): boolean {
  return (
    typeof weapon === 'string' && !['Greatsword', 'Hammer', 'Longbow', 'Short Bow', 'Spear', 'Staff'].includes(weapon)
  );
}

/** Uses chronological self-boon queries while retaining Righteous Instincts' stacked Resolution window. */
export function guardianBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  return (
    boonActive(context, boon) ||
    (boon === 'resolution' && Number(guardianRuntimeState(context).resolutionUntil || 0) > context.time)
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
  // Control events trigger effects without modeling disable windows; bonuses use the configured target state.
  return Boolean(
    context.config?.target?.disabled || context.config?.target?.defiant || context.config?.target?.defianceBroken
  );
}

const guardianCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.zealous-blade-power',
    label: 'Zealous Blade',
    target: MODIFIER_TARGET.ATTRIBUTE_POWER,
    operation: 'add',
    amount: (context) => {
      const provenance = attributeProvenance(context.config);
      const currentWeapon = activeWeapon(context);
      const zealousBladeProfile = requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE);
      return provenance.professionStaticRulesApplied
        ? (Number(currentWeapon === 'Greatsword') - Number(provenance.calculatedPrimaryWeapon === 'Greatsword')) *
            (balanceProfileNumber(zealousBladeProfile, 'weaponAttributeBonus') -
              balanceProfileNumber(zealousBladeProfile, 'attributeBonus'))
        : balanceProfileNumber(zealousBladeProfile, 'attributeBonus') +
            Number(currentWeapon === 'Greatsword') *
              (balanceProfileNumber(zealousBladeProfile, 'weaponAttributeBonus') -
                balanceProfileNumber(zealousBladeProfile, 'attributeBonus'));
    },
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)
  },
  {
    id: 'guardian.right-hand-strength-precision',
    label: 'Right-Hand Strength',
    target: MODIFIER_TARGET.ATTRIBUTE_PRECISION,
    operation: 'add',
    amount: (context) =>
      attributeProvenance(context.config).professionStaticRulesApplied
        ? 0
        : balanceProfileNumber(
            requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH),
            'attributeBonus'
          ),
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH)
  },
  {
    id: 'guardian.right-hand-strength-power',
    label: 'Right-Hand Strength',
    target: MODIFIER_TARGET.ATTRIBUTE_POWER,
    operation: 'add',
    amount: (context) => {
      const provenance = attributeProvenance(context.config);
      const currentWeapon = activeWeapon(context);
      const rightHandStrengthProfile = requireBalanceProfileFromContext(
        context,
        GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH
      );
      return provenance.professionStaticRulesApplied
        ? (Number(isOneHandedWeapon(currentWeapon)) - Number(isOneHandedWeapon(provenance.calculatedPrimaryWeapon))) *
            balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus')
        : Number(isOneHandedWeapon(currentWeapon)) * balanceProfileNumber(rightHandStrengthProfile, 'attributeBonus');
    },
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH)
  },
  {
    id: 'guardian.radiant-power-ferocity',
    label: 'Radiant Power',
    target: MODIFIER_TARGET.ATTRIBUTE_FEROCITY,
    operation: 'add',
    amount: (context) =>
      attributeProvenance(context.config).professionStaticRulesApplied
        ? 0
        : balanceProfileNumber(
            requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER),
            'attributeBonus'
          ),
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)
  },
  {
    id: 'guardian.power-of-the-virtuous-condition-damage',
    label: 'Power of the Virtuous',
    target: MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
    operation: 'add',
    amount: (context) =>
      attributeProvenance(context.config).professionStaticRulesApplied
        ? 0
        : Number(context.config?.stats?.vitality || 0) *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS),
            'attributeConversion'
          ),
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  },
  {
    id: 'guardian.bane-signet-power',
    label: 'Bane Signet',
    target: MODIFIER_TARGET.ATTRIBUTE_POWER,
    operation: 'add',
    amount: (context) => {
      // Remove a precomputed passive during recharge, or add it while ready for raw supplied attributes.
      const perfectInscriptions = hasTrait(context, GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS);
      const passiveActive =
        perfectInscriptions || !context.timeline?.skillOnCooldownAt(GUARDIAN_SKILL_IDS.BANE_SIGNET, context.time);
      const baneSignetPassiveProfile = requireBalanceProfileFromContext(context, 'guardian.core.bane-signet-passive');
      const amount =
        balanceProfileNumber(baneSignetPassiveProfile, 'attributeBonus') *
        (perfectInscriptions
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS),
              'attributeMultiplier'
            )
          : 1);
      return (
        (Number(passiveActive) - Number(attributeProvenance(context.config).professionStaticRulesApplied)) * amount
      );
    },
    when: (context) => hasSelectedSkill(context, 'Bane Signet')
  },
  {
    id: 'guardian.signet-of-wrath-condition-damage',
    label: 'Signet of Wrath',
    target: MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
    operation: 'add',
    amount: (context) => {
      const perfectInscriptions = hasTrait(context, GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS);
      const passiveActive =
        perfectInscriptions || !context.timeline?.skillOnCooldownAt(GUARDIAN_SKILL_IDS.SIGNET_OF_WRATH, context.time);
      const signetOfWrathPassiveProfile = requireBalanceProfileFromContext(
        context,
        'guardian.core.signet-of-wrath-passive'
      );
      const amount =
        balanceProfileNumber(signetOfWrathPassiveProfile, 'attributeBonus') *
        (perfectInscriptions
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.PERFECT_INSCRIPTIONS),
              'attributeMultiplier'
            )
          : 1);
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
    // Boon bonuses sum within this trait, then multiply the outgoing additive bucket.
    operation: 'multiply',
    parameters: { damagePerBoon: 0.005 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      1 + GW2_STANDARD_BOONS.filter((boon) => guardianBoonActive(context, boon)).length * parameters.damagePerBoon,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)
  },
  {
    id: 'guardian.unscathed-contender-health',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // The assumed above-90% health bonus multiplies damage; the Aegis bonus stays additive.
    operation: 'multiply',
    factor: 1.05,
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
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER),
        'criticalChance'
      ),
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER) && targetConditionActive(context, 'Burning')
  },
  {
    id: 'guardian.righteous-instincts',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS),
        'criticalChance'
      ),
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
      Math.min(
        parameters.maximumStacks,
        activeSymbolicAvengerExpirations(guardianRuntimeState(context), context.time).length
      ) * parameters.damagePerStack,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)
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
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE),
        'conditionDurationBonus'
      ),
    // Specific condition-duration bonuses add to Expertise and are skipped when panel stats already include them.
    when: (context) =>
      context.condition === 'Burning' &&
      hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE) &&
      !attributeProvenance(context.config).professionStaticRulesApplied
  }
]);

function modifyGuardianRechargeDuration(context: GuardianSkillModifierContext, duration: number): number {
  const skill = context.skill;
  let result = duration;
  if (skill?.weapon === 'Greatsword' && hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)) {
    const zealousBladeProfile = requireBalanceProfileFromContext(context, PROFILE.zealousBlade);
    result *= balanceProfileNumber(zealousBladeProfile, 'rechargeMultiplier');
  }

  if (skill?.weapon === 'Torch' && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, PROFILE.radiantFire);
    result *= balanceProfileNumber(radiantFireProfile, 'rechargeMultiplier');
  }

  if (skill?.weapon === 'Focus' && hasTrait(context, GUARDIAN_TRAIT_IDS.FOCUS_MASTERY)) {
    const focusMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.focusMastery);
    result *= balanceProfileNumber(focusMasteryProfile, 'rechargeMultiplier');
  }

  if (
    skill?.categories?.includes('Virtue') &&
    /^Profession_[1-3]$/.test(String(skill.slot || '')) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  ) {
    const powerOfTheVirtuousProfile = requireBalanceProfileFromContext(context, PROFILE.powerOfTheVirtuous);
    result *= balanceProfileNumber(powerOfTheVirtuousProfile, 'rechargeMultiplier');
  }

  return result;
}

function modifyGuardianMaximumAmmo(context: GuardianSkillModifierContext, maximum: number): number {
  let result = maximum;
  if (context.skill?.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    const radiantFireProfile = requireBalanceProfileFromContext(context, PROFILE.radiantFire);
    result = Math.max(result, balanceProfileNumber(radiantFireProfile, 'maximumStacks'));
  }

  if (context.skill?.categories?.includes('SpiritWeapon') && hasTrait(context, GUARDIAN_TRAIT_IDS.ETERNAL_ARMORY)) {
    const eternalArmoryProfile = requireBalanceProfileFromContext(context, PROFILE.eternalArmory);
    result += balanceProfileNumber(eternalArmoryProfile, 'resourceGain');
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
    const radiantFireProfile = requireBalanceProfileFromContext(context, PROFILE.radiantFire);
    result *= balanceProfileNumber(radiantFireProfile, 'durationMultiplier');
  }

  if (
    (context.sourceId === 'guardian.justice-passive' || context.event?.sourceId === 'guardian.justice-passive') &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH)
  ) {
    const amplifiedWrathProfile = requireBalanceProfileFromContext(context, PROFILE.amplifiedWrath);
    result *= balanceProfileNumber(amplifiedWrathProfile, 'durationMultiplier');
  }

  return result;
}

export const guardianCoreAttributeRules = Object.freeze({
  modifyConditionBaseDuration: modifyGuardianConditionBaseDuration,
  modifierRules: guardianCoreModifierRules,
  compileModifierRules: compileGw2ModifierRules
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
