import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { grantProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

function warriorEnduranceRegenerationRate(context: WarriorSchedulerContext, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const base = balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond');
  const vigorMultiplier = balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier');
  return base * (vigor ? vigorMultiplier : 1);
}

/** Maps pooled Vigor windows to Warrior rates while shared traversal owns capped recovery and readiness. */

export function gainWarriorEndurance(context: WarriorSchedulerContext, amount: number, at = context.state.time): void {
  grantProfessionEndurance(context, Number(amount || 0), at);
}

export function syncWarriorAdrenaline(context: WarriorSchedulerContext): void {
  const state = professionCoreState(context);
  state.adrenaline = boundedNumber(state.adrenaline || 0, 0, 0, state.maximumAdrenaline);
}

/** Applies the base Warrior adrenaline gain contract without specialization conversion. */
export function gainCoreWarriorAdrenaline(context: WarriorSchedulerContext, amount: number): void {
  const state = professionCoreState(context);
  state.adrenaline += Math.max(0, Number(amount || 0));
  syncWarriorAdrenaline(context);
}

/** Spends up to the requested adrenaline and synchronizes the public resource projection. */
export function spendWarriorAdrenalineAmount(context: WarriorCastContext, amount: number): number {
  const state = professionCoreState(context);
  const available = Number(state.adrenaline || 0);
  const spent = boundedNumber(amount, 0, 0, available);
  state.adrenaline = available - spent;
  syncWarriorAdrenaline(context);
  return spent;
}

/** Spends all available adrenaline for a normal Core burst. */
export function spendCoreWarriorAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  const state = professionCoreState(context);
  if (!skill.burst) return 0;

  return spendWarriorAdrenalineAmount(context, Number(state.adrenaline || 0));
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const warriorEndurance: EndurancePolicy<WarriorSchedulerContext> = {
  state: (context) => professionCoreState(context),
  maximum: () => 100,
  regenerationRate: (context, vigor) => warriorEnduranceRegenerationRate(context, vigor)
};
