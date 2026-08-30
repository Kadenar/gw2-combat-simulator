import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import {
  mesmerBalanceProfile,
  mesmerBalanceProfileEffect,
  mesmerBalanceValue
} from '#gw2/content/professions/mesmer/core/profiles.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import type {
  MesmerCastContext,
  MesmerSchedulerContext,
  MesmerSchedulerTask,
  MesmerShatterResolution
} from '#gw2/content/professions/mesmer/types.js';

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
  const canonicalEvent = context.eventByOrder(Number(payloadEvent.__order));
  const event = { ...payloadEvent, ...(canonicalEvent || {}) } as Extract<SimulationEvent, { readonly type: 'damage' }>;
  const deadlyBlades = mesmerBalanceProfileEffect(mesmerBalanceProfile(context, TRAIT.DEADLY_BLADES), 'condition');
  // Vulnerability follows the same sampled-or-weighted critical fact as Jagged
  // Mind, but remains a separate trait-owned condition application.
  const application = advanceScheduledCriticalProc(context, event, {
    id: 'mesmer.virtuoso.deadly-blades',
    materialization: 'weighted'
  });
  if (!application) return;

  emitSkillCondition(context, {
    cause: event,

    at: event.at,
    name: 'Deadly Blades — Vulnerability',
    skillName: event.skillName,
    condition: 'Vulnerability',
    stacks: application.quantity * Number(deadlyBlades?.stacks || 1),
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
