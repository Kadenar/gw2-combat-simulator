import { antiquaryState } from '../state.js';
import { emitStateSnapshot } from '../../../../../../platform/engine/events/state-snapshots.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import { snapshotThiefState } from '../../../core/state.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { gainThiefInitiative } from '../../../core/mechanics/resource-events.js';
import { pilferArtifacts } from './artifacts.js';
import type { ThiefCastContext, ThiefSchedulerContext, ThiefSkill } from '../../../types.js';
import { thiefBalanceProfile } from '../../../core/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

export function advanceAntiquaryResources(context: ThiefSchedulerContext, target: number): void {
  const state = antiquaryState.from(context);
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter(
    (summon) => Number(summon.expiresAt || 0) > target
  );
  const combatHighRemaining = Math.max(0, Number(state.combatHighExpiresAt || 0) - target);
  const combatHigh = thiefBalanceProfile(context, PROFILE.combatHigh);
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
    state.initiativeSpentSincePilfer >= Number(thiefBalanceProfile(context, PROFILE.prodigiousPincher)?.threshold || 15)
  ) {
    pilferArtifacts(context, context.start, 'prodigious-pincher', 'initiative');
  }
}
