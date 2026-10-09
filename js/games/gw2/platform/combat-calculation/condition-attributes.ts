import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';

// Keep profile-dependent calculations separate so modifier declaration validation cannot depend on balance profiles.
/** Replace the selected condition's scaling attribute with final Power, preserving its canonical base damage. */
export function powerScaledConditionAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2Stats,
  condition: string,
  traitId: number
): Gw2Stats {
  if (
    context.event?.condition !== condition ||
    !hasTrait(context, traitId) ||
    !isGw2PlayerModifierOwnedEvent(context.event)
  ) {
    return attributes;
  }

  const profile = requireBalanceProfileFromContext(context, traitId);
  return {
    ...attributes,
    conditionDamage: (attributes.power || 0) * balanceProfileNumber(profile, 'coefficientMultiplier')
  };
}
