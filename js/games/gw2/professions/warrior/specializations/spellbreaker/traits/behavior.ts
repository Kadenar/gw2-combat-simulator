import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount, grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';

type Runtime = Gw2Runtime<WarriorRuntimeState, WarriorSkill>;

function gainAttackersInsight(
  context: Runtime,
  state: { attackerInsightExpiries: number[] },
  at: number,
  applications = 1
): void {
  const attackersInsightProfile = requireBalanceProfileFromContext(context, TRAIT.ATTACKERS_INSIGHT);
  const effect = requireEffect(attackersInsightProfile, 'buff', 'attackers-insight');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!effect) return;
  // Keep the newest grants; a disabled cap or expired grant cannot add live stacks.
  state.attackerInsightExpiries = grantTimedStacks(state.attackerInsightExpiries, {
    at,
    expiresAt: canonicalTime(at + effectNumber(attackersInsightProfile, effect, 'duration')),
    count: Math.max(1, Math.trunc(applications)),
    maximumStacks: balanceProfileNumber(attackersInsightProfile, 'maximumStacks'),
    retain: 'newest-grant'
  });
}

function attackerInsightApplications(context: Runtime, event: Gw2ResolverEvent): number {
  // Kick grants 2 Attacker's Insight stacks instead of 1 against defiant targets.
  return ID.KICK == Number(event.skillId) && context.config.target?.defiant === true ? 2 : 1;
}

function triggerMagebaneTether(context: Runtime, state: SpellbreakerState, skill: WarriorSkill, at: number): boolean {
  // The live recharge controller uses the permanent Alacrity rate.
  const project = (progress: RechargeProgress): number => context.cooldownController.project(skill, progress);
  if (state.magebaneTetherRecharge) state.magebaneTetherReadyAt = project(state.magebaneTetherRecharge);
  if (at < gw2CooldownReadyAt(state.magebaneTetherReadyAt) || !isInternalCooldownReady(at, state.magebaneTetherReadyAt))
    return false;

  const magebaneTetherProfile = requireBalanceProfileFromContext(context, TRAIT.MAGEBANE_TETHER);
  const effect = requireEffect(magebaneTetherProfile, 'buff', 'magebane-tether');
  // A removed tether must not activate its damage window.
  if (!effect) return false;
  state.magebaneTetherUntil = canonicalTime(at + effectNumber(magebaneTetherProfile, effect, 'duration'));
  state.magebaneTetherRecharge = { startedAt: at, work: balanceProfileNumber(magebaneTetherProfile, 'cooldown') };
  state.magebaneTetherReadyAt = project(state.magebaneTetherRecharge);
  return true;
}

export function reactToSpellbreakerControl(context: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType === 'player' && hasTrait(context, TRAIT.ATTACKERS_INSIGHT)) {
    gainAttackersInsight(
      context,
      spellbreakerState.from(context),
      event.at,
      attackerInsightApplications(context, event)
    );
  }
}

// Trigger resolver-side Magebane Tether only from a qualifying player burst hit
// and record the proc when its cooldown admits a new window.
export function reactToSpellbreakerDamage(context: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(context, TRAIT.MAGEBANE_TETHER)) {
    return;
  }

  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  if (skill?.burst && triggerMagebaneTether(context, spellbreakerState.from(context), skill, event.at)) {
    context.recordProc('trait', 'Magebane Tether', event.at, event.skillName, '15% strike damage for 8 seconds');
  }
}

export function insightStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<{ attackerInsightExpiries?: number[] }>(
    context.runtime?.profession,
    'Spellbreaker'
  );
  return activeStackCount(state?.attackerInsightExpiries || [], context.time);
}

export function spellbreakerStateAt(context: Gw2ModifierContext): {
  magebaneTetherUntil?: number;
} {
  return (
    readProfessionSpecializationState<{ magebaneTetherUntil?: number }>(context.runtime?.profession, 'Spellbreaker') ||
    {}
  );
}

export function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const attackersInsightProfile = requireBalanceProfileFromContext(context, TRAIT.ATTACKERS_INSIGHT);
  const bonus = insightStacks(context) * balanceProfileNumber(attackersInsightProfile, 'attributePerStack');
  result.power += bonus;
  result.precision += bonus;
  result.ferocity += bonus;
  return result;
}
