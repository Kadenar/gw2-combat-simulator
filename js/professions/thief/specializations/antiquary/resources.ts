import { antiquaryState } from "./state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import {
  emitThiefState,
  gainThiefInitiative,
} from "../../core/shared.js";
import { pilferArtifacts } from "./artifacts.js";
import type {
  ThiefCastContext,
  ThiefSchedulerContext,
  ThiefSkill,
} from "../../types.js";

export function advanceAntiquaryResources(
  context: ThiefSchedulerContext,
  target: number,
): void {
  const state = antiquaryState.from(context);
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter(
    summon => Number(summon.expiresAt || 0) > target,
  );
  const combatHighRemaining = Math.max(
    0,
    Number(state.combatHighExpiresAt || 0) - target,
  );
  state.combatHighStacks = Math.min(
    10,
    Math.ceil(combatHighRemaining / 2),
  );
  if (Number(state.stealthAttackExpiresAt || 0) <= target) {
    state.stealthAttackCharges = 0;
  }
  if (Number(state.mistburnExpiresAt || 0) <= target) {
    state.mistburnCharges = 0;
  }
  if (
    Number(state.holoUtilityCooldownReductionExpiresAt || 0) <= target
  ) {
    state.holoUtilityCooldownReduction = 0;
    state.holoUtilityCooldownReductionExpirations = [];
  }
  for (const [skillId, penalty] of Object.entries(state.backfireState)) {
    if (Number(penalty.activeUntil || 0) <= target) {
      delete state.backfireState[skillId];
    }
  }
  emitThiefState(context, target, "resources");
}

export function spendAntiquaryResources(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = antiquaryState.from(context);
  const cost = Number(skill.initiativeCost || 0);
  if (!(cost > 0)) return;
  state.initiativeSpentSincePilfer += cost;
  if (Number(state.chakInitiativeRefundUntil || 0) > context.start) {
    gainThiefInitiative(
      context,
      cost,
      context.start,
      "chak-shield-refund",
    );
  }
  const inCombat =
    !context.hasExplicitCombatStart
    || (
      context.combatStartTime != null
      && context.start + Number(context.epsilon || 0.0001)
        >= Number(context.combatStartTime)
    );
  if (
    inCombat
    && hasThiefTrait(context.config, TRAIT.PRODIGIOUS_PINCHER)
    && state.initiativeSpentSincePilfer >= 15
  ) {
    pilferArtifacts(
      context,
      context.start,
      "prodigious-pincher",
      "initiative",
    );
  }
}
