import { signetOfTheWildBonus } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { rangerConsumingBiteModifier } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import { rangerHammerConditionsModifier } from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { rangerStalkersStrikeModifier } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { rangerFalconsStoopModifier } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerPounceModifier } from '#gw2/professions/ranger/core/skills/weapons/sword.js';
import { rangerHammerDisabledModifier } from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { eventSkill, hasSelectedSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
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

import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { gw2ConfiguredWeaponSet, gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

function weaponSetIncludes(context: Gw2ModifierContext, weaponSet: number, names: readonly string[]): boolean {
  const weapons = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return weapons.some((weapon) => names.includes(weapon || ''));
}

function openingStrikeReady(context: Gw2ModifierContext): boolean {
  const core = readProfessionCoreState<{
    playerOpeningStrikeReady?: boolean;
    petOpeningStrikeReady?: boolean;
  }>(context.runtime?.profession);
  return rangerPetEvent(context)
    ? core.petOpeningStrikeReady === true
    : isGw2PlayerModifierOwnedEvent(context.event) && core.playerOpeningStrikeReady === true;
}

function modifyRangerAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const calculatedWeapon = context.config?.attributeProvenance?.calculatedPrimaryWeapon || '';
  const calculatedWeaponSet = Number(context.config?.attributeProvenance?.calculatedWeaponSet) === 2 ? 2 : 1;
  const adjust = (attribute: Gw2NumericStatKey, amount: number): void => {
    result[attribute] = (result[attribute] || 0) + amount;
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
          (context.config?.stats?.power || 0) *
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

  const signetSelected = hasSelectedSkill(context, 'Signet of the Wild');
  const signetReady = !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_THE_WILD, context.time);
  adjust(
    'ferocity',
    signetOfTheWildBonus(context, signetSelected, signetReady) -
      signetOfTheWildBonus(context, signetSelected && staticRulesApplied)
  );

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
  return (context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) > 0;
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
    parameters: { baseFactor: 1, damagePerBoon: 0.01 },
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
  rangerHammerDisabledModifier,
  rangerPounceModifier,
  rangerFalconsStoopModifier,
  rangerStalkersStrikeModifier,
  rangerHammerConditionsModifier,
  rangerConsumingBiteModifier
];

// Keep player/shared and pet-audience collections distinct while preserving one public rule list.
export const rangerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  rangerAttackOfOpportunityModifier,
  ...rangerPlayerAndSharedModifierRules,
  ...rangerPetModifierRules
]);

export const rangerCoreModifiers = Object.freeze({
  modifyAttributes: modifyRangerAttributes,
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules
});
