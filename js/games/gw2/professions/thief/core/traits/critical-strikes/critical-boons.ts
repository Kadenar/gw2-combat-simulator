import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyNoQuarterAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (
    hasTrait(context, TRAIT.NO_QUARTER) &&
    context.query?.furyActiveAt(context.time, context.runtime, context.event) &&
    !(staticRulesApplied && Boolean((context.config?.boons as Record<string, unknown>).fury))
  ) {
    const noQuarterProfile = requireBalanceProfileFromContext(context, TRAIT.NO_QUARTER);
    result.ferocity += balanceProfileNumber(noQuarterProfile, 'attributeBonus');
  }
}
