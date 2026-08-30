import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import {
  createGw2ComboRuntimeState,
  normalizeComboFieldType,
  normalizeComboFinisherType,
  registerComboField,
  resolveComboAttempt,
  selectComboFieldForFinisher
} from '#gw2/platform/combos/events.js';
import { materializeComboOutcome } from '#gw2/platform/combos/definitions.js';
import {
  gw2BoonDurationMultiplier,
  gw2SigilSet,
  gw2StatsForWeaponSet
} from '#gw2/platform/combat/query/runtime-rules.js';

import type {
  ScheduledTask,
  SchedulerContext,
  SchedulerRecord,
  SimulationActorType,
  SimulationEvent
} from '#gw2/platform/engine/types.js';
import type {
  ComboEvent,
  ComboFieldBinding,
  ComboFieldEvent,
  ComboFieldType,
  ComboFinisherEvent,
  ComboFinisherType
} from '#gw2/platform/combos/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export const GW2_COMBO_MATERIALIZE_EVENT_TASK = 'platform.gw2.materialize-combo-event';

const COMBO_TASK_PRIORITY = -59;

interface OwnedFieldDescriptor extends SchedulerRecord {
  readonly ownerId: string;
  readonly fieldType: ComboFieldType;
  readonly startMs: number;
  readonly startAnchor: 'castStart' | 'castEnd' | 'event';
  readonly duration: number;
  readonly inclusiveExpiry?: boolean;
  readonly ownerActorType?: SimulationActorType;
}

interface OwnedFinisherDescriptor extends SchedulerRecord {
  readonly ownerId: string;
  readonly finisherType: ComboFinisherType;
  readonly chance: number;
  readonly attempts: number;
  readonly applications: number;
  readonly successfulCombos: number;
}

function currentEvent(context: SchedulerContext, original: SimulationEvent): SimulationEvent {
  return context.eventByOrder(Number(original.__order)) || original;
}

function fieldDescriptors(context: SchedulerContext, event: SimulationEvent): readonly OwnedFieldDescriptor[] {
  const skill = context.catalog.skillsById.get(event.skillId ?? event.sourceId);
  const descriptors = Array.isArray(event.comboFields)
    ? event.comboFields
    : event.type === 'action' && Array.isArray(skill?.comboFields)
      ? skill.comboFields
      : [];
  return descriptors
    .filter((raw): raw is SchedulerRecord => Boolean(raw && typeof raw === 'object' && !Array.isArray(raw)))
    .filter((raw) => String(raw.ownerId || '').length > 0)
    .map((raw) => ({
      ...raw,
      ownerId: String(raw.ownerId),
      fieldType: normalizeComboFieldType(raw.fieldType ?? raw.type),
      startMs: Math.max(0, Number(raw.startMs || 0)),
      startAnchor:
        raw.startAnchor === 'castEnd'
          ? 'castEnd'
          : raw.startAnchor === 'castStart'
            ? 'castStart'
            : event.type === 'action'
              ? 'castStart'
              : 'event',
      duration: Number(raw.duration)
    }));
}

function hasEffectFinishers(effects: readonly SchedulerRecord[] | undefined): boolean {
  return Boolean(
    effects?.some(
      (effect) =>
        Array.isArray(effect.comboFinishers) ||
        (Array.isArray(effect.ticks) &&
          effect.ticks.some((tick) => Array.isArray((tick as SchedulerRecord).comboFinishers)))
    )
  );
}

function finisherDescriptors(context: SchedulerContext, event: SimulationEvent): readonly OwnedFinisherDescriptor[] {
  const skill = context.catalog.skillsById.get(event.skillId ?? event.sourceId);
  let descriptors: readonly Readonly<SchedulerRecord>[] = [];
  if (Array.isArray(event.comboFinishers)) {
    descriptors = event.comboFinishers;
  } else if (
    Array.isArray(skill?.comboFinishers) &&
    !hasEffectFinishers(skill.effects as readonly SchedulerRecord[] | undefined)
  ) {
    const sourceMatches = event.sourceId === skill.id;
    const actionWithoutStrikes = event.type === 'action' && !skill.effects?.some((effect) => effect.type === 'strike');
    const damagingPacket = event.type === 'damage' && Number(event.coefficient || 0) > 0;
    if (sourceMatches && (actionWithoutStrikes || damagingPacket)) {
      descriptors = skill.comboFinishers;
    }
  }

  return descriptors
    .filter((raw): raw is SchedulerRecord => Boolean(raw && typeof raw === 'object' && !Array.isArray(raw)))
    .filter((raw) => String(raw.ownerId || '').length > 0)
    .map((raw) => ({
      ...raw,
      ownerId: String(raw.ownerId),
      finisherType: normalizeComboFinisherType(raw.finisherType ?? raw.type),
      chance: Math.max(0, Math.min(1, Number(raw.chance ?? 1))),
      attempts: Math.max(1, Math.trunc(Number(raw.attempts ?? 1))),
      applications: Math.max(1, Math.trunc(Number(raw.applications ?? 1))),
      successfulCombos: Math.max(1, Math.trunc(Number(raw.successfulCombos ?? 1)))
    }));
}

function fieldAt(event: SimulationEvent, descriptor: OwnedFieldDescriptor) {
  const baseAt = descriptor.startAnchor === 'castEnd' ? Number(event.endsAt ?? event.at) : event.at;
  return baseAt + descriptor.startMs / 1000;
}

function activeOwnedFields(context: SchedulerContext, ownerId: string, at: number): ComboFieldEvent[] {
  return context
    .eventsOfType('combo_field')
    .filter(
      (event): event is ComboFieldEvent =>
        event.type === 'combo_field' &&
        event.ownerId === ownerId &&
        event.at <= at + context.epsilon &&
        Number(event.expiresAt) > at + context.epsilon
    )
    .sort((left, right) => left.at - right.at || Number(left.__order || 0) - Number(right.__order || 0));
}

function descriptorBinding(
  context: SchedulerContext,
  descriptor: OwnedFinisherDescriptor,
  at: number
): {
  binding: ComboFieldBinding;
  fieldAt?: number;
  warnOnUnbound: boolean;
} {
  const explicit = descriptor.fieldBinding as ComboFieldBinding | undefined;
  if (explicit) {
    const field =
      explicit.kind === 'field-id'
        ? context
            .eventsOfType('combo_field')
            .find(
              (event): event is ComboFieldEvent =>
                event.type === 'combo_field' &&
                event.fieldId === explicit.fieldId &&
                event.at <= at + context.epsilon &&
                Number(event.expiresAt) > at + context.epsilon
            )
        : undefined;
    return { binding: explicit, fieldAt: field?.at, warnOnUnbound: false };
  }

  const fields = activeOwnedFields(context, descriptor.ownerId, at);
  const { field, ambiguous } = selectComboFieldForFinisher(fields, {
    preferredFieldTypes: descriptor.preferredFieldTypes as readonly ComboFieldType[] | undefined,
    ambiguousFieldSelection: descriptor.ambiguousFieldSelection === 'oldest' ? 'oldest' : 'none'
  });
  return {
    binding: field ? { kind: 'field-id', fieldId: field.fieldId } : { kind: 'none' },
    fieldAt: field?.at,
    warnOnUnbound: ambiguous && !field
  };
}

function taskPriority(event: SimulationEvent): number {
  const eventPriority = Number(event.priority || 0);
  return COMBO_TASK_PRIORITY + (Number.isFinite(eventPriority) ? eventPriority / 1_000_000 : 0);
}

function projectilePacketIdentity(event: SimulationEvent, parentEventOrder: number): string {
  if (event.hitIndex != null) return `hit:${String(event.hitIndex)}`;
  if (event.applicationIndex != null) {
    return `application:${String(event.applicationIndex)}`;
  }

  if (event.tickIndex != null) return `tick:${String(event.tickIndex)}`;
  return `event:${parentEventOrder}`;
}

function rebindPendingFinishers(context: SchedulerContext, ownerId: string): void {
  for (const pending of [...context.eventsOfType('combo_finisher')]) {
    if (pending.type !== 'combo_finisher' || pending.comboAllowRebind !== true || pending.comboOwnerId !== ownerId) {
      continue;
    }

    const descriptor = {
      ownerId,
      finisherType: normalizeComboFinisherType(pending.finisherType),
      chance: Number(pending.chance ?? 1),
      attempts: 1,
      applications: Number(pending.applications ?? 1),
      successfulCombos: Number(pending.successfulCombos ?? 1),
      preferredFieldTypes: pending.comboPreferredFieldTypes,
      ambiguousFieldSelection: pending.comboAmbiguousFieldSelection
    } satisfies OwnedFinisherDescriptor;
    const rebound = descriptorBinding(context, descriptor, pending.at);
    const resolvedAt = Math.max(pending.at, Number(rebound.fieldAt ?? pending.at));
    context.replaceEvent(pending, {
      at: resolvedAt,
      effectAt: Math.max(resolvedAt, Number(pending.effectAt ?? resolvedAt)),
      fieldBinding: rebound.binding,
      warnOnUnbound: rebound.warnOnUnbound
    });
  }
}

function produceField(
  context: SchedulerContext,
  event: SimulationEvent,
  descriptor: OwnedFieldDescriptor,
  descriptorIndex: number
): void {
  const at = fieldAt(event, descriptor);
  if (!(descriptor.duration > 0) || !Number.isFinite(descriptor.duration)) {
    return;
  }

  context.emitDerived(event, {
    type: 'combo_field',
    at,
    source: event.source,
    sourceId: event.sourceId,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    activationId: event.activationId,
    fieldId: `${descriptor.ownerId}:${event.activationId || event.__order}:field:${descriptorIndex + 1}`,
    fieldType: descriptor.fieldType,
    expiresAt: at + descriptor.duration + (descriptor.inclusiveExpiry === true ? context.epsilon * 2 : 0),
    ownerId: descriptor.ownerId,
    ownerActorType: descriptor.ownerActorType || event.actorType || 'player',
    comboBindingPriority: descriptor.comboBindingPriority
  });
}

function produceFinisher(
  context: SchedulerContext,
  event: SimulationEvent,
  descriptor: OwnedFinisherDescriptor,
  descriptorIndex: number
): void {
  const at = event.type === 'action' ? Number(event.endsAt ?? event.at) : event.at;
  const { binding, fieldAt: boundFieldAt, warnOnUnbound } = descriptorBinding(context, descriptor, at);
  const resolvedAt = Math.max(at, Number(boundFieldAt ?? at));
  const parentEventOrder = Number(event.causalOrder ?? event.__order ?? event.at);
  const attemptRoot = String(event.activationId || `${event.sourceId}:${event.skillName || event.name}`);
  for (let attempt = 1; attempt <= descriptor.attempts; attempt += 1) {
    const packet = descriptor.finisherType === 'Projectile';
    context.emitDerived(event, {
      type: 'combo_finisher',
      at: resolvedAt,
      effectAt: Math.max(resolvedAt, Number(descriptor.effectAt ?? at + Number(descriptor.effectDelay || 0))),
      source: event.source,
      sourceId: event.sourceId,
      actorType: event.actorType,
      skillId: event.skillId,
      skillName: event.skillName,
      parentSkillName: event.parentSkillName,
      activationId: event.activationId,
      attemptId: packet
        ? `${attemptRoot}:projectile:${String(descriptor.attemptGroup || 'skill')}:${projectilePacketIdentity(event, parentEventOrder)}:${descriptorIndex + 1}:${attempt}`
        : `${attemptRoot}:${descriptor.finisherType.toLowerCase()}:${String(descriptor.attemptGroup || 'skill')}:${descriptorIndex + 1}:${attempt}`,
      finisherType: descriptor.finisherType,
      fieldBinding: binding,
      comboAllowRebind: descriptor.fieldBinding == null,
      comboOwnerId: descriptor.ownerId,
      comboPreferredFieldTypes: descriptor.preferredFieldTypes,
      comboAmbiguousFieldSelection: descriptor.ambiguousFieldSelection,
      warnOnUnbound,
      chance: descriptor.chance,
      applications: descriptor.applications,
      successfulCombos: descriptor.successfulCombos,
      parentEventOrder
    });
  }
}

/** Produces semantic combo events from canonical descriptors on one event. */
export function produceGw2OwnedComboEvents(context: SchedulerContext, event: SimulationEvent): void {
  if (event.cancelled === true) return;
  if (Array.isArray(event.comboFields) && Number(event.hitIndex ?? event.applicationIndex ?? 1) !== 1) {
    return;
  }

  fieldDescriptors(context, event).forEach((descriptor, descriptorIndex) => {
    produceField(context, event, descriptor, descriptorIndex);
  });
  finisherDescriptors(context, event).forEach((descriptor, descriptorIndex) => {
    produceFinisher(context, event, descriptor, descriptorIndex);
  });
}

/** Chronologically predicts combo results for scheduler facts and reactions. */
export function createGw2ComboMaterializer(config: Gw2Config = {}) {
  const state = createGw2ComboRuntimeState();
  const random = createSimulationRandom(config.randomness);

  const materializer = {
    state,

    onEventScheduled(context: SchedulerContext, event: SimulationEvent): void {
      if (event.schedulerPrediction === 'combo-result') return;
      if (event.type === 'combo_field' || event.type === 'combo_finisher') {
        if (event.type === 'combo_field') {
          rebindPendingFinishers(context, String(event.ownerId));
        }

        context.tasks.schedule({
          type: GW2_COMBO_MATERIALIZE_EVENT_TASK,
          at: Math.max(context.state.time, event.at),
          priority: taskPriority(event),
          payload: { event, mode: 'resolve-event' }
        });
        return;
      }

      produceGw2OwnedComboEvents(context, event);
    },

    handleTask(context: SchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
      const original = task.payload?.event as SimulationEvent;
      const event = currentEvent(context, original);
      if (event.type === 'combo_field') {
        registerComboField(state, event as ComboFieldEvent);
        return;
      }

      if (event.type !== 'combo_finisher') return;
      const combos = resolveComboAttempt(state, event as ComboFinisherEvent, {
        stochastic: random.stochastic,
        roll: random.roll,
        warn(message) {
          context.warnings.push(message);
        }
      });
      for (const combo of combos) {
        const predictedCombo = context.emitDerived(event, {
          ...combo,
          schedulerPrediction: 'combo-result'
        }) as ComboEvent;
        for (const outcome of materializeComboOutcome(predictedCombo)) {
          const boonDuration =
            outcome.type === 'buff' && outcome.fixedDuration !== true
              ? Number(outcome.duration || 0) *
                gw2BoonDurationMultiplier(
                  String(outcome.kind || outcome.name || ''),
                  gw2StatsForWeaponSet(config, context.state.activeWeaponSet),
                  gw2SigilSet(config, context.state.activeWeaponSet)
                )
              : outcome.duration;
          context.emitDerived(predictedCombo, {
            ...outcome,
            ...(boonDuration == null ? {} : { duration: boonDuration }),
            schedulerPrediction: 'combo-result'
          });
        }
      }
    }
  };

  return Object.freeze(materializer);
}
