import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  eventSkill as gw2EventSkill,
  hasSelectedSkill,
  targetConditionActive,
  targetConditionCount,
  targetHealthBelow
} from '#gw2/platform/combat/query/runtime-query.js';
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
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats, Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
import type { RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { gw2ConfiguredWeaponSet, gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

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
  const adjust = (attribute: Gw2NumericStatKey, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };

  // Subtract only the contribution already calculated for this patch, weapon set, and assumed boon state.
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  if (!rangerPetEvent(context)) {
    for (const [trait, attribute, active, calculated] of [
      [
        TRAIT.STRIDERS_STRENGTH,
        'power',
        gw2PrimaryWeapon(context.config, activeSet) === 'Sword',
        calculatedWeapon === 'Sword'
      ],
      [
        TRAIT.HONED_AXES,
        'ferocity',
        weaponSetIncludes(context, activeSet, ['Axe']),
        weaponSetIncludes(context, calculatedWeaponSet, ['Axe'])
      ],
      [
        TRAIT.AMBIDEXTERITY,
        'conditionDamage',
        weaponSetIncludes(context, activeSet, ['Dagger', 'Mace', 'Torch']),
        weaponSetIncludes(context, calculatedWeaponSet, ['Dagger', 'Mace', 'Torch'])
      ]
    ] as const) {
      if (!hasTrait(context, trait)) continue;
      const traitProfile = requireBalanceProfileFromContext(context, trait);
      const current = balanceProfileNumber(traitProfile, active ? 'weaponAttributeBonus' : 'attributeBonus');
      const baseline = staticRulesApplied
        ? balanceProfileNumber(traitProfile, calculated ? 'weaponAttributeBonus' : 'attributeBonus')
        : 0;
      adjust(attribute, current - baseline);
    }

    if (!staticRulesApplied) {
      if (hasTrait(context, TRAIT.WELLSPRING))
        adjust(
          'healingPower',
          Number(context.config?.stats?.power || 0) *
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WELLSPRING), 'attributeConversion')
        );
    }

    if (hasTrait(context, TRAIT.VICIOUS_QUARRY)) {
      const viciousQuarryProfile = requireBalanceProfileFromContext(context, TRAIT.VICIOUS_QUARRY);
      adjust(
        'ferocity',
        (Number(rangerBoonActive(context, 'fury')) -
          Number(staticRulesApplied && Boolean(context.config?.boons?.fury))) *
          balanceProfileNumber(viciousQuarryProfile, 'attributeBonus')
      );
    }
  }

  // Shared base bonuses also apply to pet queries before their family-specific bonuses.
  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.ARACHNOPHOBIA))
      adjust(
        'expertise',
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA), 'attributeBonus')
      );
    if (hasTrait(context, TRAIT.LINGERING_MAGIC))
      adjust(
        'concentration',
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_MAGIC), 'attributeBonus')
      );
  }

  modifyRangerPetAttributes(context, result, staticRulesApplied);

  if (hasSelectedSkill(context, 'Signet of the Wild')) {
    const active = !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_THE_WILD, context.time);
    const signetOfTheWildProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfTheWild);
    const bonus = balanceProfileNumber(signetOfTheWildProfile, 'attributeBonus');
    if (staticRulesApplied) adjust('ferocity', active ? 0 : -bonus);
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
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.trappersExpertise),
        skill.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier'
      )
    );
  }

  let extension = 0;
  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && positional(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension = balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet),
        'durationPerTier'
      );
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      extension = balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet),
        'durationPerTier'
      );
    } else if (skill?.id === ID.CRIPPLING_SHOT && context.condition === 'Immobilized') {
      extension = balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet),
        'minimumStacks'
      );
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
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HUNTERS_TACTICS), 'criticalChance'),
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
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'conditionDurationBonus'
      ),
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
      rangerBoonActive(context, 'light-on-your-feet')
  },
  {
    id: 'ranger.vicious-quarry-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VICIOUS_QUARRY), 'criticalChance'),
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
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PRECISE_STRIKE), 'criticalChance'),
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
    // Spear bonuses are evaluated at impact so live conditions and the health threshold affect the correct hit.
    id: 'ranger.falcons-stoop-disabled',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      eventSkill(context)?.id === ID.FALCONS_STOOP &&
      Boolean(
        context.config?.target?.defiant ||
        context.config?.target?.disabled ||
        context.config?.target?.defianceBroken ||
        targetConditionActive(context, 'Immobilized')
      )
  },
  {
    id: 'ranger.spear-leap-low-health',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      (eventSkill(context)?.id === ID.WARCLAWS_ENGAGE || eventSkill(context)?.id === ID.PREDATORS_AMBUSH) &&
      targetHealthBelow(context, 0.5)
  },
  {
    id: 'ranger.stalkers-strike-movement-impaired',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.stalkersStrikeImpaired),
        'damageMultiplier'
      ),
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
    // Canonical queries deduplicate aliases and count only conditions active at this observation time.
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

export const rangerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyRangerAttributes,
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules,
  compileModifierRules: compileGw2ModifierRules
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
      result *= balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.quickDraw),
        'rechargeMultiplier'
      );
    }

    if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.HONED_AXES)) {
      result *= balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.honedAxes),
        'rechargeMultiplier'
      );
    }

    if (skill?.weapon === 'Shortbow' && hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
      result *= balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.lightOnYourFeet),
        'rechargeMultiplier'
      );
    }

    // Lead the Wind reduces every supported longbow skill's base recharge before shared recharge-rate scaling.
    if (skill?.weapon === 'Longbow' && hasTrait(context, TRAIT.LEAD_THE_WIND)) {
      result *= balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.leadTheWind),
        'rechargeMultiplier'
      );
    }

    if (['Dagger', 'Torch'].includes(String(skill?.weapon || '')) && hasTrait(context, TRAIT.AMBIDEXTERITY)) {
      result *= balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.ambidexterity),
        'rechargeMultiplier'
      );
    }

    if (skill?.petSkill && hasTrait(context, TRAIT.PACK_ALPHA)) {
      result *= balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.packAlpha),
        'rechargeMultiplier'
      );
    }

    return result;
  }
});
