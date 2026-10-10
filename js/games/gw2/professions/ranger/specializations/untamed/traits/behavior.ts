import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Ambushes own the delivery time; their accepted proc resolves the selected trait balance at impact. */
export function naturalFortitudeAmbushEffect(atMs: number): SkillEffect {
  return {
    type: 'custom',
    eventType: 'ranger.natural-fortitude',
    event: {},
    atMs,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
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
