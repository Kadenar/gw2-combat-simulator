import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive, skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/stats.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { qualifiesForFlankingBonuses } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Reconciles the live weapon bonus against the calculated weapon baseline. */
export function stridersStrengthAttributeDelta(context: Gw2ModifierContext): number {
  if (!hasTrait(context, TRAIT.STRIDERS_STRENGTH)) return 0;
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const calculatedWeapon = context.config?.attributeProvenance?.calculatedPrimaryWeapon || '';
  const profile = requireBalanceProfileFromContext(context, TRAIT.STRIDERS_STRENGTH);
  return (
    balanceProfileNumber(
      profile,
      gw2PrimaryWeapon(context.config, activeSet) === 'Sword' ? 'weaponAttributeBonus' : 'attributeBonus'
    ) -
    (professionStaticRulesApplied(context.config)
      ? balanceProfileNumber(profile, calculatedWeapon === 'Sword' ? 'weaponAttributeBonus' : 'attributeBonus')
      : 0)
  );
}

// Apply skill-specific multipliers and convert flat shortbow extensions into
// multipliers before general Expertise scaling.
export function modifyRangerConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  let result = multiplier;
  const skill = skillForEvent(context.profession?.catalog, context.event, context.skillId);
  if (skill?.categories?.includes('Trap') && hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)) {
    return (
      multiplier *
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.TRAPPERS_EXPERTISE),
        skill.id === ID.FLAME_TRAP ? 'coefficientMultiplier' : 'durationMultiplier'
      )
    );
  }

  // Intrinsic shortbow extensions remain native behavior, independent of preview duration overrides.
  // TODO -> THESE WILL BE GOING AWAY IN NOVEMBER PATCH
  let extension = 0;
  if (qualifiesForFlankingBonuses(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension += 1;
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      // Defiant foes already receive this intrinsic bonus in live; it is unchanged by the preview.
      extension += 2;
    }
  }

  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) && qualifiesForFlankingBonuses(context)) {
    if (skill?.id === ID.CROSSFIRE && context.condition === 'Bleeding') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'durationPerTier'
      );
    } else if (skill?.id === ID.POISON_VOLLEY && context.condition === 'Poisoned') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'durationPerTier'
      );
    } else if (skill?.id === ID.CRIPPLING_SHOT && context.condition === 'Immobilized') {
      extension += balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
        'minimumStacks'
      );
    }
  }

  const baseDuration = Number(
    skill?.effects?.find((effect) => effect.type === 'condition' && effect.condition === context.condition)?.duration ||
      0
  );
  if (extension !== 0 && baseDuration > 0) result *= Math.max(0, baseDuration + extension) / baseDuration;
  return result;
}

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyViciousQuarryAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  staticRulesApplied: boolean
): void {
  if (hasTrait(context, TRAIT.VICIOUS_QUARRY)) {
    const viciousQuarryProfile = requireBalanceProfileFromContext(context, TRAIT.VICIOUS_QUARRY);
    adjust(
      'ferocity',
      (Number(boonActive(context, 'fury')) - Number(staticRulesApplied && Boolean(context.config?.boons?.fury))) *
        balanceProfileNumber(viciousQuarryProfile, 'attributeBonus')
    );
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyStridersStrengthPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.STRIDERS_STRENGTH)) {
    const stridersStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.STRIDERS_STRENGTH);
    attributes.power += balanceProfileNumber(stridersStrengthProfile, 'attributeBonus');
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyFangAndClawPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  },
  petName: string
): void {
  if (
    hasTrait(context, TRAIT.FANG_AND_CLAW) &&
    ['feline', 'avian', 'drake'].includes(rangerPetByName(petName).family)
  ) {
    const fangAndClawProfile = requireBalanceProfileFromContext(context, TRAIT.FANG_AND_CLAW);
    attributes.precision += balanceProfileNumber(fangAndClawProfile, 'attributeBonus');
    attributes.ferocity += balanceProfileNumber(fangAndClawProfile, 'weaponAttributeBonus');
  }
}
