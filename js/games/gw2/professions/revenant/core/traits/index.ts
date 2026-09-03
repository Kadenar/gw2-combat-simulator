/**
 * Dispatches Core Revenant trait behavior while preserving base-skill and relic event order.
 * Trait-line modules remain private implementation details behind this public surface.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { effectFirstAtMs, strikeEffectCoefficient } from '#gw2/platform/engine/effects/timelines.js';
import { effectiveRevenantEnergyCost } from '#gw2/professions/revenant/energy.js';
import {
  applySongOfTheMists,
  applySpiritBoon,
  emitLegendInvocationProfile,
  emitLegendInvocationSkill
} from '#gw2/professions/revenant/core/traits/invocation.js';
import { applyAbyssalChill, applyInvokingTorment } from '#gw2/professions/revenant/core/traits/corruption.js';
import {
  applyAssassinsPresence,
  applyBattleScarred,
  applyBrutality,
  applyDanceOfDeath,
  applyExposeDefenses,
  applyNotoriety,
  applyThrillOfCombat,
  consumeBattleScar
} from '#gw2/professions/revenant/core/traits/devastation.js';
import { applyDwarvenBattleTraining, applyViciousReprisal } from '#gw2/professions/revenant/core/traits/retribution.js';
import { requireRevenantEffect as effectByType } from '#gw2/professions/revenant/core/traits/profile-access.js';
import type { SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  RevenantCastContext,
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

export { emitLegendInvocationProfile, emitLegendInvocationSkill };

interface ImpossibleOddsTaskPayload extends SchedulerRecord {
  readonly event: SimulationEvent;
}

const IMPOSSIBLE_ODDS_TASK = 'revenant.impossible-odds-strike';

function canTriggerImpossibleOdds(event: RevenantSimulationEvent): boolean {
  return (
    event.type === 'damage' &&
    Number(event.coefficient || 0) > 0 &&
    event.skillId !== ID.IMPOSSIBLE_ODDS &&
    (event.actorType === 'player' || event.source === 'Sigil')
  );
}

/** Reports whether invocation-only combat effects may run at a timestamp. */
export function revenantCombatActive(context: RevenantSchedulerContext, at = context.state.time): boolean {
  return (
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && at + context.epsilon >= Number(context.combatStartTime))
  );
}

/** Emits a delayed Impossible Odds strike when its upkeep and ICD are active. */
export function handleImpossibleOddsStrike(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<ImpossibleOddsTaskPayload>
): void {
  if (!task.payload) return;
  const cause = task.payload.event;
  const state = professionCoreState(context);
  const impossible = context.catalog.skillsById.get(ID.IMPOSSIBLE_ODDS);
  if (
    !impossible ||
    !(state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === impossible.id) ||
    task.at + context.epsilon < Number(state.traitProcReadyAt.impossibleOdds || 0)
  ) {
    return;
  }

  const strike = effectByType(impossible, 'strike');
  if (strike?.type !== 'strike') return;
  state.traitProcReadyAt.impossibleOdds = task.at + Number(impossible.triggerIntervalMs || 0) / 1000;
  emitSkillDamage(context, {
    cause,
    at: task.at + Number(effectFirstAtMs(strike) || 0) / 1000,
    name: 'Impossible Odds',
    skillName: 'Impossible Odds',
    coefficient: strikeEffectCoefficient(strike),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'revenant',
    sourceId: impossible.id,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: impossible.id,
    skillWeapon: 'Unequipped',
    canTriggerCriticalSigils: true
  });
}

/** Seeds trait-owned proc state that depends on the selected build. */
export function initializeRevenantTraits(_context: RevenantSchedulerContext): void {}

/** Applies active trait/state cast-speed changes to a base duration. */
export function modifyRevenantCastDuration(_context: RevenantPrecastContext, duration: number): number {
  return duration;
}

/** Applies trait-specific recharge multipliers after shared Alacrity policy. */
export function modifyRevenantRechargeDuration(context: RevenantRechargeContext, duration: number): number {
  const skill = context.skill;
  if (skill && ([ID.SWAP_LEGENDS, ID.SWAP_WEAPONS] as readonly number[]).includes(Number(skill.id))) {
    if (duration === 0) return 0;
    return Math.max(0, Number(skill.cooldown ?? skill.recharge ?? duration));
  }

  return duration;
}

/** Applies selected invocation traits in their stable legend-swap order. */
export function applyLegendInvocationTraits(context: RevenantCastContext, _swapSkill: RevenantSkill): void {
  const at = context.effectiveEnd;
  const legendId = professionCoreState(context).activeLegendId;
  applySpiritBoon(context, legendId, at);
  applySongOfTheMists(context, legendId, at);
  applyInvokingTorment(context, at);
}

/** Commits trait effects and Embrace bookkeeping after cast packet handling finishes. */
export function afterRevenantCast(context: RevenantCastContext, skill: RevenantSkill): void {
  applyBattleScarred(context, skill);
  if (revenantCombatActive(context, context.effectiveEnd)) applyNotoriety(context, skill);

  if (
    !([ID.EMBRACE_THE_DARKNESS, ID.RESIST_THE_DARKNESS] as readonly number[]).includes(Number(skill.id)) &&
    // Only Energy-costing skills empower Embrace; free attacks such as Shattershot do not.
    effectiveRevenantEnergyCost(context, skill) > 0
  ) {
    const embrace = professionCoreState(context).activeUpkeeps.find(
      (upkeep) => upkeep.skillId === ID.EMBRACE_THE_DARKNESS
    );
    if (embrace) embrace.empoweredNextPulse = true;
  }
}

/** Observes each scheduler event once and preserves mixed trait, relic, and base-skill ordering. */
export function observeRevenantEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (canTriggerImpossibleOdds(event)) {
    context.tasks.schedule({
      id: `${IMPOSSIBLE_ODDS_TASK}:${event.eventOrder}`,
      type: IMPOSSIBLE_ODDS_TASK,
      at: event.at,
      payload: { event }
    });
  }

  if (
    context.config.relic === 'Peitha' &&
    event.type === 'damage' &&
    ((event.skillName === 'Deathstrike' && event.name === 'Initial Damage') ||
      event.skillName === "Phantom's Onslaught" ||
      event.skillId === ID.PHASE_SMASH)
  ) {
    const delay = event.skillId === ID.PHASE_SMASH ? 0 : event.skillName === 'Deathstrike' ? 0.24 : 0.68;
    context.emitDerived(event, {
      type: 'peitha',
      at: event.at + delay,
      source: 'revenant',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Relic of Peitha'
    });
  }

  applyBrutality(context, event);
  applyDwarvenBattleTraining(context, event);
  if (event.type === 'condition') {
    applyAbyssalChill(context, event);
    applyDanceOfDeath(context, event);
  }

  if (event.type === 'damage' && event.actorType === 'player' && Number(event.coefficient || 0) > 0) {
    applyThrillOfCombat(context, event);
    consumeBattleScar(context, event);
    applyAssassinsPresence(context, event);
    applyViciousReprisal(context, event);
    if (revenantCombatActive(context, event.at)) applyExposeDefenses(context, event);

    const daggers = professionCoreState(context).enchantedDaggers;
    if (
      event.skillId !== ID.ENCHANTED_DAGGERS &&
      Number(daggers?.charges || 0) > 0 &&
      event.at < Number(daggers.expiresAt || 0) &&
      isInternalCooldownReady(event.at, Number(daggers.readyAt || 0))
    ) {
      const enchantedDaggers = context.catalog.skillsById.get(ID.ENCHANTED_DAGGERS);
      if (!enchantedDaggers) throw new Error('Missing Enchanted Daggers skill declaration.');
      const strike = effectByType(enchantedDaggers, 'strike');
      const buff = effectByType(enchantedDaggers, 'buff');
      const delay = Number(strike.atMs || 0) / 1000;
      daggers.charges -= 1;
      daggers.readyAt = event.at + delay;
      emitSkillDamage(context, {
        cause: event,
        at: event.at + delay,
        source: 'revenant',
        sourceId: ID.ENCHANTED_DAGGERS,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: ID.ENCHANTED_DAGGERS,
        skillName: 'Enchanted Daggers',
        name: 'Enchanted Daggers — Siphon Damage',
        coefficient: 0,
        flatStrikeBase: Number(strike.flatStrikeBase || 0),
        flatStrikePowerCoeff: Number(strike.flatStrikePowerCoeff || 0),
        noCrit: true,
        hits: 1,
        hitIndex: Number(buff.stacks || 0) - daggers.charges,
        totalHits: Number(buff.stacks || 0)
      });
    }
  }
}
