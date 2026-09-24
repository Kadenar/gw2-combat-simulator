import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import {
  spellbreakerState,
  type SpellbreakerState
} from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import type {
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

// Kick grants 2 Attacker's Insight stacks instead of 1 against defiant targets.
const DOUBLE_DEFIANT_CONTROL_INSIGHT_SKILLS = new Set<number>([ID.KICK]);

function gainAttackersInsight(
  context: WarriorSchedulerContext | WarriorResolverContext,
  state: { attackerInsightExpiries: number[] },
  at: number,
  applications = 1
): void {
  const attackersInsightProfile = requireBalanceProfileFromContext(context, PROFILE.attackersInsight);
  const effect = requireEffect(attackersInsightProfile, 'buff', 'attackers-insight');
  // Removed packets do not open their associated state or schedule follow-ups.
  if (!effect) return;
  // Keep the newest grants; a disabled cap or expired grant cannot add live stacks.
  state.attackerInsightExpiries = grantTimedStacks(state.attackerInsightExpiries, {
    at,
    expiresAt: at + effectNumber(attackersInsightProfile, effect, 'duration'),
    count: Math.max(1, Math.trunc(applications)),
    maximumStacks: balanceProfileNumber(attackersInsightProfile, 'maximumStacks'),
    retain: 'newest-grant'
  });
}

function attackerInsightApplications(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent
): number {
  return DOUBLE_DEFIANT_CONTROL_INSIGHT_SKILLS.has(Number(event.skillId)) && context.config.target?.defiant === true
    ? 2
    : 1;
}

function triggerMagebaneTether(
  context: WarriorSchedulerContext | WarriorResolverContext,
  state: SpellbreakerState,
  skill: WarriorSkill,
  at: number
): boolean {
  // Both execution stages use engine-owned progress so transient Alacrity updates the entire recharge.
  const project = (progress: RechargeProgress): number =>
    'cooldownController' in context
      ? context.cooldownController.project(skill, progress)
      : context.query.timeline.rechargeReadyAt(skill, progress);
  if (state.magebaneTetherRecharge) state.magebaneTetherReadyAt = project(state.magebaneTetherRecharge);
  if (at < gw2CooldownReadyAt(state.magebaneTetherReadyAt) || !isInternalCooldownReady(at, state.magebaneTetherReadyAt))
    return false;

  const magebaneTetherProfile = requireBalanceProfileFromContext(context, PROFILE.magebaneTether);
  const effect = requireEffect(magebaneTetherProfile, 'buff', 'magebane-tether');
  // A removed tether must not activate its damage window.
  if (!effect) return false;
  state.magebaneTetherUntil = at + effectNumber(magebaneTetherProfile, effect, 'duration');
  state.magebaneTetherRecharge = { startedAt: at, work: balanceProfileNumber(magebaneTetherProfile, 'cooldown') };
  state.magebaneTetherReadyAt = project(state.magebaneTetherRecharge);
  return true;
}

// Target boons never exist; only control and burst damage drive Attacker's
// Insight, No Escape, and Magebane Tether state without cross-event duplication.
export function observeSpellbreakerEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.actorType !== 'player') return;
  if (event.type === 'control') {
    if (hasTrait(context, TRAIT.ATTACKERS_INSIGHT)) {
      gainAttackersInsight(
        context,
        spellbreakerState.from(context),
        event.at,
        attackerInsightApplications(context, event)
      );
    }

    if (
      hasTrait(context, TRAIT.NO_ESCAPE) &&
      ['daze', 'stun'].includes(String(event.controlKind || '').toLowerCase())
    ) {
      const noEscapeProfile = requireBalanceProfileFromContext(context, PROFILE.noEscape);
      const effect = requireEffect(noEscapeProfile, 'condition', 'Immobilized');
      if (effect)
        emitSkillCondition(context, {
          cause: event,

          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.NO_ESCAPE,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName,
          name: 'No Escape - Immobilized',
          condition: 'Immobilized',
          stacks: effectNumber(noEscapeProfile, effect, 'stacks'),
          duration: effectNumber(noEscapeProfile, effect, 'duration')
        });
    }

    return;
  }

  if (event.type !== 'damage' || !(Number(event.coefficient) > 0)) {
    return;
  }

  if (!hasTrait(context, TRAIT.MAGEBANE_TETHER)) return;
  const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
  if (skill?.burst) {
    triggerMagebaneTether(context, spellbreakerState.from(context), skill, event.at);
  }
}

export function reactToSpellbreakerControl(context: WarriorResolverContext, event: WarriorResolverEvent): void {
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
export function reactToSpellbreakerDamage(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(context, TRAIT.MAGEBANE_TETHER)) {
    return;
  }

  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  if (skill?.burst && triggerMagebaneTether(context, spellbreakerState.from(context), skill, event.at)) {
    context.recordProc('trait', 'Magebane Tether', event.at, event.skillName, '15% strike damage for 8 seconds');
  }
}
