import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Direct simulations convert configured Vitality at the original imperative attribute boundary; built stats already include it. */
export function quietIntensityFerocity(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.QUIET_INTENSITY) && !professionStaticRulesApplied(context.config)
    ? (context.config?.stats?.vitality || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'vitalityConversion')
    : 0;
}

/** Preserve the original combined attribute adjustment so its zero-delta and provenance behavior stays intact. */
export function applyVirtuosoTraitAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats
): Gw2ResolvedStats {
  const staticApplied = professionStaticRulesApplied(context.config);
  const quietIntensityDelta = quietIntensityFerocity(context);
  const sharpeningSorrowDelta = hasTrait(context, TRAIT.SHARPENING_SORROW)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHARPENING_SORROW), 'expertiseBonus') *
      (Number(boonActive(context, 'fury')) - Number(staticApplied && Boolean(context.config?.boons?.fury)))
    : 0;
  if (quietIntensityDelta === 0 && sharpeningSorrowDelta === 0) return attributes;
  return {
    ...attributes,
    ferocity: (attributes.ferocity || 0) + quietIntensityDelta,
    expertise: (attributes.expertise || 0) + sharpeningSorrowDelta
  };
}
