import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { TRAITS } from '#gw2/professions/ranger/data/traits-data.js';

/** Ambushes retain their authored first-hit timing and unconditional life-steal packet. */
export function naturalFortitudeAmbushEffect(atMs: number): SkillEffect {
  return {
    type: 'strike',
    sourceId: TRAIT.NATURAL_FORTITUDE,
    name: 'Natural Fortitude',
    // Separate the siphon in the breakdown while retaining the ambush's combat attribution.
    damageBreakdownName: 'Life Siphon - Natural Fortitude',
    // Use the granting trait's artwork instead of the triggering ambush's icon.
    icon: String(TRAITS.find((trait) => trait.id === TRAIT.NATURAL_FORTITUDE)?.icon || ''),
    // Life siphon adds Power to its base damage without weapon, armor, or critical scaling.
    ticks: [{ atMs, coefficient: 0 }],
    flatStrikeBase: 3517,
    flatStrikePowerCoeff: 0.005,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    canCrit: false,
    damageKind: 'life-steal'
  };
}

/** Adds selected Natural Fortitude Vitality when the supplied stats do not already include static trait rules. */
export function modifyNaturalFortitudeAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats
): Gw2ResolvedStats {
  if (!hasTrait(context, TRAIT.NATURAL_FORTITUDE)) return attributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (staticRulesApplied && context.event?.actorType === 'summon') return attributes;
  const result = { ...attributes };
  const naturalFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.NATURAL_FORTITUDE);
  const vitality = balanceProfileNumber(naturalFortitudeProfile, 'attributeBonus');
  result.vitality = (result.vitality || 0) + (staticRulesApplied ? 0 : vitality);
  return result;
}
