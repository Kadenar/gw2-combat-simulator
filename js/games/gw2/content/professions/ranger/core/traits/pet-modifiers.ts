/** Owns Ranger pet-audience attributes and rules so player modifier composition stays explicit. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/core/profiles.js';
import { rangerPetByName } from '#gw2/content/professions/ranger/core/state.js';
import {
  rangerActiveBoonCount,
  rangerBoonActive,
  rangerPetEvent,
  rangerTargetImpaired
} from '#gw2/content/professions/ranger/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';

function activePetFamily(context: Gw2ModifierContext): string {
  const activePet = readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet;
  return rangerPetByName(String(activePet || context.config?.selectedPet || 'Pig')).family;
}

// Apply only companion-specific family bonuses and the pet form of Wellspring's conversion.
export function modifyRangerPetAttributes(
  context: Gw2ModifierContext,
  result: Gw2ResolvedStats,
  staticRulesApplied: boolean
): void {
  if (!rangerPetEvent(context)) return;
  const adjust = (attribute: keyof Gw2ResolvedStats, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };

  const family = activePetFamily(context);

  if (hasTrait(context, TRAIT.FANG_AND_CLAW) && ['feline', 'avian', 'drake'].includes(family)) {
    adjust('precision', balanceProfileValueFromContext(context, PROFILE.fangAndClaw, 'attributeBonus', 420));
    adjust('ferocity', balanceProfileValueFromContext(context, PROFILE.fangAndClaw, 'weaponAttributeBonus', 450));
  }

  if (hasTrait(context, TRAIT.ARACHNOPHOBIA) && ['spider', 'devourer'].includes(family)) {
    adjust('expertise', balanceProfileValueFromContext(context, PROFILE.arachnophobia, 'weaponAttributeBonus', 225));
  }

  if (!hasTrait(context, TRAIT.WELLSPRING)) return;
  const conversion = balanceProfileValueFromContext(context, PROFILE.wellspring, 'attributeConversion', 0.07);
  if (staticRulesApplied) adjust('healingPower', -Number(context.config?.stats?.power || 0) * 0.07);
  const summonBasePower = Number(context.event?.summonBasePower);
  const petPower =
    Number.isFinite(summonBasePower) && summonBasePower > 0
      ? summonBasePower +
        (context.query?.mightStacksAt(context.time, context.runtime || undefined, context.event || undefined) || 0) * 30
      : Number(result.power || 0);
  adjust('healingPower', petPower * conversion);
}

export const rangerPetModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => rangerPetEvent(context) && rangerBoonActive(context, 'sic-em-pet')
  },
  {
    id: 'ranger.lesser-sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => rangerPetEvent(context) && rangerBoonActive(context, 'lesser-sic-em-pet')
  },
  {
    id: 'ranger.bountiful-hunter-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1, damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor + rangerActiveBoonCount(context, 'pet') * parameters.damagePerBoon,
    when: (context) => rangerPetEvent(context) && hasTrait(context, TRAIT.BOUNTIFUL_HUNTER)
  },
  {
    id: 'ranger.predators-onslaught-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      rangerPetEvent(context) && rangerTargetImpaired(context) && hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT)
  },
  {
    id: 'ranger.loud-whistle-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) => rangerPetEvent(context) && hasTrait(context, TRAIT.LOUD_WHISTLE)
  }
]);
