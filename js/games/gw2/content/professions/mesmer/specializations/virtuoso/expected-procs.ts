import { emitSkillCondition } from '../../../../../platform/scheduler/skill-events.js';
import type { SimulationEvent } from '../../../../../platform/engine/types.js';
import { advanceScheduledCriticalProc } from '../../../../../platform/scheduler/critical-facts.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerBalanceProfile, mesmerBalanceProfileEffect } from '../../core/profiles.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type { MesmerSchedulerContext, MesmerSchedulerTask, MesmerVirtuosoExpectedProcCandidate } from '../../types.js';
import { virtuosoState } from './state.js';

const PROC_PROGRESS_TOLERANCE = 1e-9;

/** Queues Virtuoso bleeding and blade-critical reactions at their chronological event time. */
export function observeVirtuosoExpectedProcEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = mesmerRuntimeFor(context);
  let candidate: MesmerVirtuosoExpectedProcCandidate | null = null;
  if (event.type === 'condition' && event.condition === 'Bleeding' && runtime.traits.has(TRAIT.BLOODSONG)) {
    candidate = { type: 'bleeding', at: event.at, stacks: event.stacks };
  } else if (event.type === 'damage' && runtime.traits.has(TRAIT.JAGGED_MIND)) {
    const skill = runtime.skillsById.get(Number(event.skillId));
    if ((event.blade || skill?.blade) && event.noCrit !== true && event.canCrit !== false) {
      candidate = {
        type: 'blade',
        at: event.at,
        event: event.blade ? event : { ...event, blade: true }
      };
    }
  }

  if (!candidate) return;
  context.tasks.schedule({
    type: 'mesmer.virtuoso-expected-proc',
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId: event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
    payload: candidate
  });
}

/** Reduces Virtuoso expected-proc candidates into Jagged Mind bleeding or Bloodsong blades. */
export function handleVirtuosoExpectedProcTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'virtuosoExpectedProc'>
): void {
  const runtime = mesmerRuntimeFor(context);
  if (task.payload.type === 'bleeding') {
    const state = virtuosoState.from(context);
    state.bloodsongProgress += Number(task.payload.stacks || 0);
    const profile = mesmerBalanceProfile(context, TRAIT.BLOODSONG);
    const threshold = Number(profile?.threshold || 5);
    while (state.bloodsongProgress >= threshold - PROC_PROGRESS_TOLERANCE) {
      state.bloodsongProgress -= threshold;
      runtime.resources.queueResources(
        task.payload.at + context.epsilon,
        Number(profile?.resourceGain || 1),
        runtime.activePrimaryWeapon(),
        'Bloodsong',
        { traitId: TRAIT.BLOODSONG, traitName: 'Bloodsong' }
      );
    }

    return;
  }

  const payloadEvent = task.payload.event;
  const canonicalEvent = context.eventByOrder(Number(payloadEvent.__order));
  const event = { ...payloadEvent, ...(canonicalEvent || {}) } as Extract<SimulationEvent, { readonly type: 'damage' }>;
  // Jagged Mind applies fractional expected stacks directly in deterministic
  // mode, while stochastic mode consumes the canonical sampled critical fact.
  const application = advanceScheduledCriticalProc(context, event, {
    id: 'mesmer.virtuoso.jagged-mind',
    materialization: 'weighted'
  });
  if (!application) return;
  const effect = mesmerBalanceProfileEffect(mesmerBalanceProfile(context, TRAIT.JAGGED_MIND), 'condition');
  emitSkillCondition(context, {
    cause: event,

    at: event.at,
    name: `${event.name} — Jagged Mind`,
    skillName: event.skillName,
    parentSkillName: event.parentSkillName,
    condition: 'Bleeding',
    duration: Number(effect?.duration || 4),
    stacks: application.quantity * Number(effect?.stacks || 1),
    source: event.source,
    sourceId: TRAIT.JAGGED_MIND,
    actorType: event.actorType
  });
  runtime.addTraitProc('Jagged Mind', event.at, event.skillName);
}
