import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

/** Lead Attacks also boosts owned flat life steal, which bypasses ordinary strike modifiers. */
export function modifyThiefLifeSiphon(context: ThiefResolverContext, event: ThiefResolverEvent) {
  if (
    !event.lifeSiphon ||
    ![event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(Number.isFinite) ||
    !isGw2PlayerModifierOwnedEvent(event) ||
    !hasTrait(context.config, TRAIT.LEAD_ATTACKS)
  )
    return;

  const state = readProfessionCoreState<ThiefCoreState>(context.profession);
  const leadAttacksProfile = requireBalanceProfileFromContext(context, PROFILE.leadAttacks);
  // Stacks expire individually, so the siphon counts those active at its own impact.
  const stacks = Math.min(
    balanceProfileNumber(leadAttacksProfile, 'maximumStacks'),
    activeStackCount(state.leadAttackExpirations || [], event.at)
  );
  return {
    flatStrikeMultiplier:
      Number(event.flatStrikeMultiplier ?? 1) *
      (1 + stacks * balanceProfileNumber(leadAttacksProfile, 'damageIncreasePerStack'))
  };
}
