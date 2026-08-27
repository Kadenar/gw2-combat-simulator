import { emitSkillCondition } from '../../../../platform/gw2/scheduler/skill-events.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { gw2RechargeRate } from '../../../../platform/gw2/combat/query/runtime-rules.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { warriorBoonRemovalCounts } from '../../core/resolver.js';
import { warriorBalanceProfile, warriorBalanceProfileEffect } from '../../core/profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { spellbreakerState } from './state.js';
import type {
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent
} from '../../types.js';

// Kick grants 2 Attacker's Insight stacks instead of 1 against defiant targets.
const DOUBLE_DEFIANT_CONTROL_INSIGHT_SKILLS = new Set<number>([ID.KICK]);

function gainAttackersInsight(
  context: WarriorSchedulerContext | WarriorResolverContext,
  state: { attackerInsightExpiries: number[] },
  at: number,
  applications = 1
): void {
  const profile = warriorBalanceProfile(context, PROFILE.attackersInsight);
  const effect = warriorBalanceProfileEffect(profile, 'buff');
  const expiries = Array.from(
    { length: Math.max(1, Math.trunc(applications)) },
    () => at + Number(effect?.duration ?? 15)
  );
  // slice(-max) drops the oldest stacks when at cap, matching game behavior.
  state.attackerInsightExpiries = state.attackerInsightExpiries
    .filter((expiresAt) => expiresAt > at)
    .concat(expiries)
    .slice(-Number(profile?.maximumStacks ?? 5));
}

function attackerInsightApplications(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent
): number {
  return DOUBLE_DEFIANT_CONTROL_INSIGHT_SKILLS.has(Number(event.skillId)) && context.config.target?.defiant === true
    ? 2
    : 1;
}

function attackerInsightFromBoonRemoval(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent
): { attempted: number; removed: number; applications: number } {
  const { attempted, removed } = warriorBoonRemovalCounts(context, event);
  return { attempted, removed, applications: removed };
}

function triggerMagebaneTether(
  context: WarriorSchedulerContext | WarriorResolverContext,
  state: {
    magebaneTetherUntil: number;
    magebaneTetherReadyAt: number;
  },
  at: number
): boolean {
  if (!isInternalCooldownReady(at, state.magebaneTetherReadyAt)) return false;
  const profile = warriorBalanceProfile(context, PROFILE.magebaneTether);
  const effect = warriorBalanceProfileEffect(profile, 'buff');
  state.magebaneTetherUntil = at + Number(effect?.duration ?? 8);
  // Divide by recharge rate so alacrity reduces the internal cooldown.
  state.magebaneTetherReadyAt = at + Number(profile?.cooldown ?? 12) / gw2RechargeRate(context.config);
  return true;
}

// Translate scheduled boon removal, control, and burst damage into Attacker's
// Insight, No Escape, and Magebane Tether state without cross-event duplication.
export function observeSpellbreakerEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.actorType !== 'player') return;

  if (event.type === 'warrior.boon-removal') {
    const { applications } = attackerInsightFromBoonRemoval(context, event);

    if (applications > 0 && hasTrait(context, TRAIT.ATTACKERS_INSIGHT)) {
      gainAttackersInsight(context, spellbreakerState.from(context), event.at, applications);
    }

    return;
  }

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
      const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.noEscape), 'condition');
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
        stacks: Number(effect?.stacks ?? 1),
        duration: Number(effect?.duration ?? 1)
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
    triggerMagebaneTether(context, spellbreakerState.from(context), event.at);
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

  if (skill?.burst && triggerMagebaneTether(context, spellbreakerState.from(context), event.at)) {
    context.recordProc('trait', 'Magebane Tether', event.at, event.skillName, '15% strike damage for 8 seconds');
  }
}
