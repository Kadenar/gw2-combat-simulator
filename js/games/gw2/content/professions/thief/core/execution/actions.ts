/** Owns immediate Core Thief action callbacks; persistent summon behavior lives in mechanics. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import type { ThiefCastContext } from '#gw2/content/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';

/** Applies Thief-only stance cleanup and Quick Pockets after the shared swap. */
export function applyThiefWeaponSwapEffects(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.kneeling = false;
  emitThiefStateSnapshot(context, at, 'stand');
  const inCombat =
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && at + Number(context.epsilon || 0.0001) >= Number(context.combatStartTime));
  if (
    inCombat &&
    hasTrait(context.config, TRAIT.QUICK_POCKETS) &&
    isInternalCooldownReady(at, Number(state.quickPocketsReadyAt || 0))
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.quickPockets);
    state.quickPocketsReadyAt = at + Number(profile?.internalCooldown || 8);
    gainThiefInitiative(context, Number(profile?.resourceGain || 3), at, 'quick-pockets');
  }
}

/** Enters the Kneel stance after its action completes. */
export function kneel(context: ThiefCastContext): void {
  professionCoreState(context).kneeling = true;
  emitThiefStateSnapshot(context, context.effectiveEnd, 'kneel');
}

/** Leaves the Kneel stance after its action completes. */
export function stand(context: ThiefCastContext): void {
  professionCoreState(context).kneeling = false;
  emitThiefStateSnapshot(context, context.effectiveEnd, 'stand');
}

/** Opens Assassin's Signet active window and suppresses its passive until recharge. */
export function activateAssassinsSignet(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.assassinsSignetActiveUntil =
    at + Number(balanceProfileFromContext(context, PROFILE.assassinsSignet)?.durationMultiplier || 5);
  state.assassinsSignetPassiveDisabledUntil = Number(
    context.rechargeReadyAt || context.state.cooldowns.get(ID.ASSASSINS_SIGNET) || at
  );
  emitThiefStateSnapshot(context, at, 'assassins-signet');
}
