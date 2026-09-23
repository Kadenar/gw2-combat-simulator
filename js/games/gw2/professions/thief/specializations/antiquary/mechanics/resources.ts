import { expireCharges } from '#gw2/platform/combat/resources/charges.js';
import { EPSILON } from '#kernel/core/clock.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { pilferArtifacts } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import type { ThiefCastContext, ThiefSchedulerContext, ThiefSkill } from '#gw2/professions/thief/types.js';

import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';

export function advanceAntiquaryResources(context: ThiefSchedulerContext, target: number): void {
  const state = antiquaryState.from(context);
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter(
    (summon) => Number(summon.expiresAt || 0) > target
  );
  state.combatHighExpirations = purgeExpiredStacks(state.combatHighExpirations, target);
  if (Number(state.stealthAttackExpiresAt || 0) <= target) {
    state.stealthAttackCharges = 0;
  }

  expireCharges(state.mistburn, target);

  // Expire each charge independently without changing FIFO grant order.
  state.holoUtilityCooldownReductionExpirations = purgeExpiredStacks(
    state.holoUtilityCooldownReductionExpirations,
    target
  );

  for (const [skillId, penalty] of Object.entries(state.backfireState)) {
    if (Number(penalty.activeUntil || 0) <= target) {
      delete state.backfireState[skillId];
    }
  }

  emitThiefStateSnapshot(context, target, 'resources');
}

export function spendAntiquaryResources(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = antiquaryState.from(context);
  const cost = Number(skill.initiativeCost || 0);
  if (!(cost > 0)) return;
  state.initiativeSpentSincePilfer += cost;
  if (Number(state.chakInitiativeRefundUntil || 0) > context.start) {
    gainThiefInitiative(context, cost, context.start, 'chak-shield-refund');
  }

  // Prodigious Pincher should not fire during pre-cast; initiative spent before combat begins must not count toward the threshold
  const inCombat =
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && context.start + EPSILON >= Number(context.combatStartTime));
  if (
    inCombat &&
    hasTrait(context.config, TRAIT.PRODIGIOUS_PINCHER) &&
    state.initiativeSpentSincePilfer >=
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.prodigiousPincher), 'threshold')
  ) {
    pilferArtifacts(context, context.start, 'prodigious-pincher', 'initiative');
  }
}
