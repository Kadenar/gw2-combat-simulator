import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { eventSkill as gw2EventSkill, hasSelectedSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerCoreCastAvailability } from '#gw2/professions/ranger/core/mechanics/availability.js';
import { stalkersStrikeTargetImpaired } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerAttackOfOpportunityModifier } from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import {
  rangerActiveBoonCount,
  rangerBoonActive,
  rangerPetEvent,
  rangerTargetImpaired
} from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import {
  modifyRangerPetAttributes,
  rangerPetModifierRules
} from '#gw2/professions/ranger/core/traits/pet-modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';
import type { RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { gw2ConfiguredWeaponSet, gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

// Count distinct configured or live target conditions at query time for traits
// that scale from condition variety rather than stack count.
function targetConditionCount(context: Gw2ModifierContext): number {
  const active = new Set(
    Object.entries(context.config?.target?.conditions || {})
      .filter(([, value]) => value === true || Number(value) > 0)
      .map(([condition]) => condition)
  );
  const runtime = context.runtime as
    | {
        conditionState?: Map<string, { stacks?: readonly { expiresAt?: number }[] }>;
      }
    | undefined;
  for (const [condition, entry] of runtime?.conditionState || []) {
    if ((entry.stacks || []).some((stack) => Number(stack.expiresAt) > context.time)) {
      active.add(condition);
    }
  }

  return active.size;
}

function weaponSetIncludes(context: Gw2ModifierContext, weaponSet: number, names: readonly string[]): boolean {
  const weapons = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return weapons.some((weapon) => names.includes(String(weapon || '')));
}

// Keeps Ranger-specific skill typing while using the shared modifier-context lookup precedence.
const eventSkill = (context: Gw2ModifierContext): RangerSkill | undefined => gw2EventSkill<RangerSkill>(context);

function openingStrikeReady(context: Gw2ModifierContext): boolean {
  const core = readProfessionCoreState<{
    playerOpeningStrikeReady?: boolean;
    petOpeningStrikeReady?: boolean;
  }>(context.runtime?.profession);
  return rangerPetEvent(context)
    ? core?.petOpeningStrikeReady === true
    : isGw2PlayerModifierOwnedEvent(context.event) && core?.playerOpeningStrikeReady === true;
}

function modifyRangerAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const calculatedWeapon = String(context.config?.attributeProvenance?.calculatedPrimaryWeapon || '');
  const calculatedWeaponSet = Number(context.config?.attributeProvenance?.calculatedWeaponSet) === 2 ? 2 : 1;
  const adjust = (attribute: keyof Gw2ResolvedStats, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };

  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
      const bonus = balanceProfileValueFromContext(context, PROFILE.stridersStrength, 'attributeBonus', 120);
      adjust(
        'power',
        bonus +
          (gw2PrimaryWeapon(context.config, Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1) === 'Sword'
            ? bonus
            : 0)
      );
    }

    if (hasTrait(context, TRAIT.HONED_AXES)) {
      const bonus = balanceProfileValueFromContext(context, PROFILE.honedAxes, 'attributeBonus', 120);
      adjust(
        'ferocity',
        bonus + (weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), ['Axe']) ? bonus : 0)
      );
    }

    if (hasTrait(context, TRAIT.VICIOUS_QUARRY) && rangerBoonActive(context, 'fury')) {
      adjust('ferocity', balanceProfileValueFromContext(context, PROFILE.viciousQuarry, 'attributeBonus', 250));
    }

    if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
      adjust('expertise', balanceProfileValueFromContext(context, PROFILE.arachnophobia, 'attributeBonus', 150));
    }

    if (hasTrait(context, TRAIT.LINGERING_MAGIC)) {
      adjust('concentration', balanceProfileValueFromContext(context, PROFILE.lingeringMagic, 'attributeBonus', 240));
    }

    if (hasTrait(context, TRAIT.AMBIDEXTERITY)) {
      const bonus = balanceProfileValueFromContext(context, PROFILE.ambidexterity, 'attributeBonus', 120);
      adjust(
        'conditionDamage',
        weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), ['Dagger', 'Mace', 'Torch'])
          ? bonus * 2
          : bonus
      );
    }

    if (hasTrait(context, TRAIT.WELLSPRING) && !rangerPetEvent(context)) {
      // Convert gear-only power (config.stats), not the live power
      // that already includes might and Strider's Strength.
      adjust(
        'healingPower',
        Number(context.config?.stats?.power || 0) *
          balanceProfileValueFromContext(context, PROFILE.wellspring, 'attributeConversion', 0.07)
      );
    }
  }

  if (staticRulesApplied && !rangerPetEvent(context) && hasTrait(context, TRAIT.HONED_AXES)) {
    const bonus = balanceProfileValueFromContext(context, PROFILE.honedAxes, 'attributeBonus', 120);
    const activeHasAxe = weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), ['Axe']);
    const calculatedHasAxe = weaponSetIncludes(context, calculatedWeaponSet, ['Axe']);
    adjust('ferocity', bonus * (1 + Number(activeHasAxe)) - 120 * (1 + Number(calculatedHasAxe)));
  }

  if (staticRulesApplied && !rangerPetEvent(context) && hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
    const bonus = balanceProfileValueFromContext(context, PROFILE.stridersStrength, 'attributeBonus', 120);
    adjust(
      'power',
      bonus *
        (1 +
          Number(
            gw2PrimaryWeapon(context.config, Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1) === 'Sword'
          )) -
        120 * (1 + Number(calculatedWeapon === 'Sword'))
    );
  }

  if (staticRulesApplied && !rangerPetEvent(context) && hasTrait(context, TRAIT.AMBIDEXTERITY)) {
    const bonus = balanceProfileValueFromContext(context, PROFILE.ambidexterity, 'attributeBonus', 120);
    const favored = ['Dagger', 'Mace', 'Torch'];
    const active = weaponSetIncludes(context, Number(context.runtime?.activeWeaponSet), favored);
    const calculated = weaponSetIncludes(context, calculatedWeaponSet, favored);
    adjust('conditionDamage', bonus * (1 + Number(active)) - 120 * (1 + Number(calculated)));
  }

  if (staticRulesApplied && !rangerPetEvent(context)) {
    if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
      adjust('expertise', balanceProfileValueFromContext(context, PROFILE.arachnophobia, 'attributeBonus', 150) - 150);
    }

    if (hasTrait(context, TRAIT.LINGERING_MAGIC)) {
      adjust(
        'concentration',
        balanceProfileValueFromContext(context, PROFILE.lingeringMagic, 'attributeBonus', 240) - 240
      );
    }

    if (hasTrait(context, TRAIT.WELLSPRING)) {
      adjust(
        'healingPower',
        Number(context.config?.stats?.power || 0) *
          (balanceProfileValueFromContext(context, PROFILE.wellspring, 'attributeConversion', 0.07) - 0.07)
      );
    }

    if (hasTrait(context, TRAIT.VICIOUS_QUARRY)) {
      const configuredFury = Boolean(context.config?.boons?.fury);
      const activeFury = rangerBoonActive(context, 'fury');
      adjust(
        'ferocity',
        Number(activeFury) * balanceProfileValueFromContext(context, PROFILE.viciousQuarry, 'attributeBonus', 250) -
          Number(configuredFury) * 250
      );
    }
  }

  modifyRangerPetAttributes(context, result, staticRulesApplied);

  if (hasSelectedSkill(context, 'Signet of the Wild')) {
    const active = !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_THE_WILD, context.time);
    const bonus = balanceProfileValueFromContext(context, PROFILE.signetOfTheWild, 'attributeBonus', 180);
    if (staticRulesApplied) adjust('ferocity', active ? bonus - 180 : -180);
    if (!staticRulesApplied && active) adjust('ferocity', bonus);
  }

  return result;
}

// Apply skill-specific multipliers and convert flat shortbow extensions into
// multipliers before general Expertise scaling.
function modifyRangerConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  let result = multiplier;
  const skill = eventSkill(context);
  if (skill?.categories?.includes('Trap') && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    return (
      multiplier *
      balanceProfileValueFromContext(
        context,
        PROFILE.trappersExpertise,
        skill.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier',
        skill.id === ID.FLAME_TRAP ? 1.66 : 1.6
      )
    );
  }

  let extension = 0;
  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && positional(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension = balanceProfileValueFromContext(context, PROFILE.lightOnYourFeet, 'durationPerTier', 2);
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      extension = balanceProfileValueFromContext(context, PROFILE.lightOnYourFeet, 'durationPerTier', 2);
    } else if (skill?.id === ID.CRIPPLING_SHOT && context.condition === 'Immobilized') {
      extension = balanceProfileValueFromContext(context, PROFILE.lightOnYourFeet, 'minimumStacks', 1);
    }
  }

  const baseDuration = Number(
    skill?.effects?.find((effect) => effect.type === 'condition' && effect.condition === context.condition)?.duration ||
      0
  );
  if (extension > 0 && baseDuration > 0) result *= (baseDuration + extension) / baseDuration;
  return result;
}

function positional(context: Gw2ModifierContext): boolean {
  // Defiant is the positional proxy: a defiant golem never rotates, so
  // flanking/behind bonuses always apply and need no separate control.
  return Boolean(context.config?.target?.defiant);
}

function targetVulnerable(context: Gw2ModifierContext): boolean {
  return Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) > 0;
}

const rangerPlayerAndSharedModifierRules: readonly Gw2ModifierRule[] = [
  {
    id: 'ranger.hunters-tactics-damage',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && positional(context) && hasTrait(context, TRAIT.HUNTERS_TACTICS)
  },
  {
    id: 'ranger.hunters-tactics-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && positional(context) && hasTrait(context, TRAIT.HUNTERS_TACTICS)
  },
  {
    id: 'ranger.light-on-your-feet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
      rangerBoonActive(context, 'light-on-your-feet')
  },
  {
    id: 'ranger.light-on-your-feet-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
      rangerBoonActive(context, 'light-on-your-feet')
  },
  {
    id: 'ranger.vicious-quarry-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => hasTrait(context, TRAIT.VICIOUS_QUARRY) && rangerBoonActive(context, 'fury')
  },
  {
    id: 'ranger.farsighted',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      eventSkill(context)?.type === 'Weapon' &&
      hasTrait(context, TRAIT.FARSIGHTED)
  },
  {
    id: 'ranger.bountiful-hunter-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1, damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor + rangerActiveBoonCount(context, 'player') * parameters.damagePerBoon,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.BOUNTIFUL_HUNTER)
  },
  {
    id: 'ranger.wolfsong',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && targetVulnerable(context) && hasTrait(context, TRAIT.WOLFSONG)
  },
  {
    id: 'ranger.remorseless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) => openingStrikeReady(context) && hasTrait(context, TRAIT.REMORSELESS)
  },
  {
    id: 'ranger.precise-strike',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 1,
    when: (context) => openingStrikeReady(context) && hasTrait(context, TRAIT.PRECISE_STRIKE)
  },
  {
    id: 'ranger.predators-onslaught-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      rangerTargetImpaired(context) &&
      hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT)
  },
  {
    id: 'ranger.hidden-barbs',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) => context.condition === 'Bleeding' && hasTrait(context, TRAIT.HIDDEN_BARBS)
  },
  {
    id: 'ranger.poison-master',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    // The damage bonus is Ranger-owned; the separately triggered pet attack also resolves from Ranger stats.
    when: (context) =>
      context.condition === 'Poisoned' &&
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.POISON_MASTER)
  },
  {
    id: 'ranger.survival-instincts',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.SURVIVAL_INSTINCTS)
  },
  {
    id: 'ranger.disabled-skill-bonus',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      Boolean(
        String(context.event?.damageKind || '').startsWith('ranger-unleashed-disabled') &&
        (context.config?.target?.defiant || context.config?.target?.disabled || context.config?.target?.defianceBroken)
      )
  },
  {
    id: 'ranger.pounce-defiant',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      context.event?.damageKind === 'ranger-pounce-defiant' &&
      Boolean(
        context.config?.target?.defiant || context.config?.target?.disabled || context.config?.target?.defianceBroken
      )
  },
  {
    id: 'ranger.stalkers-strike-movement-impaired',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    // Double only this skill's strike when Cripple, Slow, or Immobilize is active.
    when: (context) =>
      gw2EventSkill(context)?.id === ID.STALKERS_STRIKE &&
      stalkersStrikeTargetImpaired(context.config, context.time, context.runtime)
  },
  {
    id: 'ranger.condition-count-skill-bonus',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1, damagePerCondition: 0.02 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor + targetConditionCount(context) * parameters.damagePerCondition,
    when: (context) => context.event?.damageKind === 'ranger-unleashed-disabled-condition-count'
  },
  {
    id: 'ranger.consuming-bite-condition-count',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      maximumConditions: 5,
      coefficientPerCondition: 0.025
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const coefficient = Number(context.event?.coefficient || 0);
      if (!(coefficient > 0)) return 1;
      const conditions = Math.min(parameters.maximumConditions, targetConditionCount(context));
      return (coefficient + conditions * parameters.coefficientPerCondition) / coefficient;
    },
    when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.CONSUMING_BITE
  }
];

// Keep player/shared and pet-audience collections distinct while preserving one public rule list.
export const rangerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  rangerAttackOfOpportunityModifier,
  ...rangerPlayerAndSharedModifierRules,
  ...rangerPetModifierRules
]);

export function compileRangerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

export const rangerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyRangerAttributes,
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules,
  compileModifierRules: compileRangerModifierRules
});

export const rangerCoreCastRules = Object.freeze({
  availability: {
    id: 'ranger.core-availability',
    order: 10,
    handler: rangerCoreCastAvailability
  },
  modifyRechargeDuration(context: RangerSchedulerContext & { skill?: RangerSkill }, duration: number): number {
    const skill = context.skill;
    let result = duration;
    const state = professionCoreState(context);
    if (
      skill?.type === 'Weapon' &&
      skill.slot !== 'Weapon_1' &&
      state.quickDrawUntil > context.state.time &&
      hasTrait(context, TRAIT.QUICK_DRAW)
    ) {
      result *= balanceProfileValueFromContext(context, PROFILE.quickDraw, 'rechargeMultiplier', 0.34);
    }

    if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.HONED_AXES)) {
      result *= balanceProfileValueFromContext(context, PROFILE.honedAxes, 'rechargeMultiplier', 0.8);
    }

    if (skill?.weapon === 'Shortbow' && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
      result *= balanceProfileValueFromContext(context, PROFILE.lightOnYourFeet, 'rechargeMultiplier', 0.8);
    }

    if (['Dagger', 'Torch'].includes(String(skill?.weapon || '')) && hasTrait(context, TRAIT.AMBIDEXTERITY)) {
      result *= balanceProfileValueFromContext(context, PROFILE.ambidexterity, 'rechargeMultiplier', 0.8);
    }

    if (skill?.petSkill && hasTrait(context, TRAIT.PACK_ALPHA)) {
      result *= balanceProfileValueFromContext(context, PROFILE.packAlpha, 'rechargeMultiplier', 0.8);
    }

    return result;
  }
});
