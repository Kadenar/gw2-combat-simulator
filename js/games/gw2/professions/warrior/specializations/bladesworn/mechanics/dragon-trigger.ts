import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { Gw2TraitLookupContext } from '#gw2/platform/combat/state/traits.js';
import type { CastCommand } from '#gw2/platform/execution/types.js';

import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { clamp } from '#kernel/core/numeric.js';

export const DRAGON_TRIGGER_ENTRY_RESOURCE_REASON = 'dragon trigger entry';
export const DRAGON_TRIGGER_TICK_RESOURCE_REASON = 'dragon trigger charge';

export function dragonSlashCoefficient(
  minimum: number,
  maximum: number,
  charges: number,
  maximumCharges: number
): number {
  if (maximumCharges <= 1) return maximum;
  const resolvedCharges = clamp(charges, 1, maximumCharges);
  return minimum + (maximum - minimum) * ((resolvedCharges - 1) / (maximumCharges - 1));
}

// Maps charges to adrenaline bars spent (1 bar = 10): 1-4 charges → 10,
// 5-9 → 20, 10 → 30. Used by burst traits that scale on adrenaline bars.
export function dragonChargesToAdrenalineSpent(charges: number): number {
  if (charges >= 10) return 30;
  if (charges >= 5) return 20;
  return charges > 0 ? 10 : 0;
}

export function maximumDragonCharges(context: Gw2TraitLookupContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? balanceProfileNumber(dragonTriggerProfile, 'minimumStacks')
    : balanceProfileNumber(dragonTriggerProfile, 'maximumStacks');
}

export function dragonFlowPerInterval(context: Gw2TraitLookupContext): number {
  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  const cost = balanceProfileNumber(dragonTriggerProfile, 'resourceCost');
  return hasTrait(context, TRAIT.DARING_DRAGON)
    ? cost *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DARING_DRAGON), 'resourceCostMultiplier')
    : cost;
}

export function requestedDragonCharges(
  context: { readonly command: Pick<CastCommand, 'releaseAtCharges'> },
  maximumCharges: number
): number {
  const configured = context.command.releaseAtCharges;
  if (configured == null) return maximumCharges;
  return clamp(configured, 1, maximumCharges);
}
// Shared reason string so both the availability check and the charge-release
// projection surface the same message in the UI.

export const ENTER_DRAGON_TRIGGER_REASON = 'Enter Dragon Trigger before using this skill.';
