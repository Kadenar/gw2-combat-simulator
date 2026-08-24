import { EPSILON } from '../../../../platform/engine/core/clock.js';
import type { SimulationEvent } from '../../../../platform/engine/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerBalanceProfile, mesmerBalanceProfileEffect, mesmerBalanceValue } from '../../core/profiles.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type {
  MesmerCastContext,
  MesmerSchedulerContext,
  MesmerSchedulerTask,
  MesmerShatterResolution
} from '../../types.js';

/** Activates Deadly Blades only after a successfully resolved Virtuoso Bladesong. */
export function resolveDeadlyBlades(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  const runtime = mesmerRuntimeFor(context);
  if (!runtime.traits.has(TRAIT.DEADLY_BLADES)) return;

  const at = resolution.at + context.epsilon;
  runtime.addEvent({
    type: 'buff',
    at,
    kind: 'deadly-blades',
    stacks: 1,
    duration: mesmerBalanceValue(context, TRAIT.DEADLY_BLADES, 'durationMultiplier', 7)
  });
  runtime.addTraitProc('Deadly Blades', at, resolution.skill.name);
}

/** Queues Virtuoso-owned critical resolution for blade strikes that can trigger Deadly Blades vulnerability. */
export function observeDeadlyBladesEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = mesmerRuntimeFor(context);
  if (event.type !== 'damage' || !runtime.traits.has(TRAIT.DEADLY_BLADES)) return;

  const skill = runtime.skillsById.get(Number(event.skillId));
  if (!event.blade && !skill?.blade) return;
  if (event.noCrit || event.canCrit === false) return;

  context.tasks.schedule({
    type: 'mesmer.deadly-blades-critical',
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId: event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
    payload: { event: event.blade ? event : { ...event, blade: true } }
  });
}

/** Applies Deadly Blades as a target condition after the engine materializes the blade strike's critical result. */
export function handleDeadlyBladesCriticalTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'deadlyBladesCritical'>
): void {
  const runtime = mesmerRuntimeFor(context);
  const payloadEvent = task.payload.event;
  const canonicalEvent = context.events.find((candidate) => candidate.__order === payloadEvent.__order);
  const event = { ...payloadEvent, ...(canonicalEvent || {}) } as Extract<SimulationEvent, { readonly type: 'damage' }>;
  const deadlyBlades = mesmerBalanceProfileEffect(mesmerBalanceProfile(context, TRAIT.DEADLY_BLADES), 'condition');
  const vulnerabilityStacks =
    context.config.randomness?.mode === 'stochastic'
      ? event.didCrit
        ? 1
        : 0
      : context.schedulerPolicy.critical?.(context, event)?.chance || 0;
  if (vulnerabilityStacks <= EPSILON) return;

  context.emitDerived(event, {
    type: 'condition',
    at: event.at,
    name: 'Deadly Blades — Vulnerability',
    skillName: event.skillName,
    condition: 'Vulnerability',
    stacks: vulnerabilityStacks * Number(deadlyBlades?.stacks || 1),
    duration: Number(deadlyBlades?.duration || 5),
    source: 'Trait',
    sourceId: TRAIT.DEADLY_BLADES,
    sourceSkill: event.skillName
  });
  context.emitDerived(event, {
    type: 'weakness_vulnerability',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.DEADLY_BLADES,
    skillName: event.skillName
  });
}
