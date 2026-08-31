import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { antiquaryState } from '#gw2/content/professions/thief/specializations/antiquary/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import { pilferArtifacts } from '#gw2/content/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import type { ThiefCastContext, ThiefSchedulerContext, ThiefSkill } from '#gw2/content/professions/thief/types.js';

import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/specializations/antiquary/profiles.js';

export function advanceAntiquaryResources(context: ThiefSchedulerContext, target: number): void {
  const state = antiquaryState.from(context);
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter(
    (summon) => Number(summon.expiresAt || 0) > target
  );
  const combatHighRemaining = Math.max(0, Number(state.combatHighExpiresAt || 0) - target);
  const combatHigh = balanceProfileFromContext(context, PROFILE.combatHigh);
  state.combatHighStacks = Math.min(
    Number(combatHigh?.maximumStacks || 10),
    Math.ceil(combatHighRemaining / Number(combatHigh?.pulseInterval || 2))
  );
  if (Number(state.stealthAttackExpiresAt || 0) <= target) {
    state.stealthAttackCharges = 0;
  }

  if (Number(state.mistburnExpiresAt || 0) <= target) {
    state.mistburnCharges = 0;
  }

  if (Number(state.holoUtilityCooldownReductionExpiresAt || 0) <= target) {
    // bulk-clear the per-use expiration list once the last window has passed; individual uses are consumed in rules.ts
    state.holoUtilityCooldownReduction = 0;
    state.holoUtilityCooldownReductionExpirations = [];
  }

  for (const [skillId, penalty] of Object.entries(state.backfireState)) {
    if (Number(penalty.activeUntil || 0) <= target) {
      delete state.backfireState[skillId];
    }
  }

  emitStateSnapshot(context, 'thief', target, 'resources', snapshotThiefState(context.state.profession));
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
    (context.combatStartTime != null &&
      context.start + Number(context.epsilon || 0.0001) >= Number(context.combatStartTime));
  if (
    inCombat &&
    hasTrait(context.config, TRAIT.PRODIGIOUS_PINCHER) &&
    state.initiativeSpentSincePilfer >=
      Number(balanceProfileFromContext(context, PROFILE.prodigiousPincher)?.threshold || 15)
  ) {
    pilferArtifacts(context, context.start, 'prodigious-pincher', 'initiative');
  }
}
