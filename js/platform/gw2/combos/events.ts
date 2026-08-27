import { EPSILON } from '../../engine/core/clock.js';
import { clamp } from '../combat/numeric.js';
import { comboDefinition } from './definitions.js';

import type { SchedulerRecord, SimulationActorType, SimulationEventInput } from '../../engine/types.js';
import type {
  ComboEvent,
  ComboFieldBinding,
  ComboFieldEvent,
  ComboFieldType,
  ComboFinisherEvent,
  ComboFinisherType,
  Gw2ComboRuntimeState
} from './types.js';

export const COMBO_FIELD_TYPES: readonly ComboFieldType[] = Object.freeze([
  'Dark',
  'Ethereal',
  'Fire',
  'Ice',
  'Light',
  'Lightning',
  'Poison',
  'Smoke',
  'Water'
]);

export const COMBO_FINISHER_TYPES: readonly ComboFinisherType[] = Object.freeze([
  'Blast',
  'Leap',
  'Projectile',
  'Whirl'
]);

const ACTOR_TYPES = new Set<SimulationActorType>(['player', 'summon', 'effect', 'environment', 'unknown']);
const FIELD_TYPES_BY_LOWERCASE = new Map(COMBO_FIELD_TYPES.map((type) => [type.toLowerCase(), type]));
const FINISHER_TYPES_BY_LOWERCASE = new Map(COMBO_FINISHER_TYPES.map((type) => [type.toLowerCase(), type]));

function requiredString(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();

  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}

function positiveInteger(value: unknown, label: string): number {
  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }

  return normalized;
}

/** Normalizes and validates a combo field type. */
export function normalizeComboFieldType(value: unknown): ComboFieldType {
  const normalized = FIELD_TYPES_BY_LOWERCASE.get(String(value ?? '').toLowerCase());

  if (!normalized) throw new TypeError(`Invalid combo field type: ${String(value)}.`);
  return normalized;
}

/** Normalizes and validates a combo finisher type. */
export function normalizeComboFinisherType(value: unknown): ComboFinisherType {
  const normalized = FINISHER_TYPES_BY_LOWERCASE.get(String(value ?? '').toLowerCase());

  if (!normalized) {
    throw new TypeError(`Invalid combo finisher type: ${String(value)}.`);
  }

  return normalized;
}

export interface SelectComboFieldOptions {
  readonly preferredFieldTypes?: readonly ComboFieldType[];
  readonly ambiguousFieldSelection?: 'none' | 'oldest';
}

/** Selects one owned field, honoring an authoritative field before preferences. */
export function selectComboFieldForFinisher(
  fields: readonly ComboFieldEvent[],
  options: SelectComboFieldOptions = {}
): { readonly field?: ComboFieldEvent; readonly ambiguous: boolean } {
  const ordered = [...fields].sort(
    (left, right) => left.at - right.at || Number(left.__order || 0) - Number(right.__order || 0)
  );
  // comboBindingPriority > 0 marks an authoritative field (e.g., the specific
  // field placed by a skill that also carries a finisher). When present, only
  // those high-priority fields are candidates — ambient fields are ignored.
  const highestBindingPriority = ordered.reduce(
    (highest, field) => Math.max(highest, Number(field.comboBindingPriority || 0)),
    0
  );
  const candidates =
    highestBindingPriority > 0
      ? ordered.filter((field) => Number(field.comboBindingPriority || 0) === highestBindingPriority)
      : ordered;
  const preferredTypes = (options.preferredFieldTypes || []).map(normalizeComboFieldType);
  const preferred = preferredTypes
    .map((fieldType) => candidates.find((field) => field.fieldType === fieldType))
    .find(Boolean);
  // Ambiguous means multiple different field types are present; same type repeated is not ambiguous.
  const ambiguous = new Set(candidates.map((field) => field.fieldType)).size > 1;
  // Priority: preferred type → oldest unambiguous → undefined when ambiguous with no match/override.
  return {
    field: preferred || (!ambiguous || options.ambiguousFieldSelection === 'oldest' ? candidates[0] : undefined),
    ambiguous
  };
}

/** Normalizes and validates a finisher-to-field binding declaration. */
export function normalizeComboFieldBinding(value: unknown): ComboFieldBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Combo finisher fieldBinding is required.');
  }

  const binding = value as SchedulerRecord;

  if (binding.kind === 'none') return Object.freeze({ kind: 'none' });

  if (binding.kind === 'field-id') {
    return Object.freeze({
      kind: 'field-id',
      fieldId: requiredString(binding.fieldId, 'Combo field binding fieldId')
    });
  }

  if (binding.kind === 'field-type') {
    return Object.freeze({
      kind: 'field-type',
      fieldType: normalizeComboFieldType(binding.fieldType)
    });
  }

  throw new TypeError(`Invalid combo field binding kind: ${String(binding.kind)}.`);
}

/** Normalizes and validates GW2-owned semantic events before engine freezing. */
export function prepareGw2ComboEvent(event: SimulationEventInput): SimulationEventInput {
  if (event.type === 'combo_field') {
    const at = Number(event.at);
    const expiresAt = Number(event.expiresAt);
    const comboBindingPriority = event.comboBindingPriority == null ? null : Number(event.comboBindingPriority);

    if (!Number.isFinite(expiresAt) || !(expiresAt > at)) {
      throw new TypeError('Combo field expiresAt must be later than at.');
    }

    if (comboBindingPriority != null && (!Number.isFinite(comboBindingPriority) || comboBindingPriority < 0)) {
      throw new TypeError('Combo field comboBindingPriority must be a non-negative finite number.');
    }

    if (!ACTOR_TYPES.has(event.ownerActorType as SimulationActorType)) {
      throw new TypeError('Combo field ownerActorType is invalid.');
    }

    return {
      ...event,
      // Fields default to priority -1 so they sort before finishers (default 0)
      // and are visible in state before the finisher that reacts to them.
      priority: event.priority ?? -1,
      fieldId: requiredString(event.fieldId, 'Combo field fieldId'),
      fieldType: normalizeComboFieldType(event.fieldType),
      expiresAt,
      ownerId: requiredString(event.ownerId, 'Combo field ownerId'),
      ...(comboBindingPriority == null ? {} : { comboBindingPriority })
    };
  }

  if (event.type === 'combo_finisher') {
    const at = Number(event.at);
    const effectAt = Number(event.effectAt);

    if (!Number.isFinite(effectAt) || effectAt < at) {
      throw new TypeError('Combo finisher effectAt must not precede at.');
    }

    const chance = Number(event.chance);

    if (!Number.isFinite(chance)) {
      throw new TypeError('Combo finisher chance must be finite.');
    }

    const parentEventOrder = event.parentEventOrder == null ? null : Number(event.parentEventOrder);

    if (parentEventOrder != null && !Number.isFinite(parentEventOrder)) {
      throw new TypeError('Combo finisher parentEventOrder must be finite.');
    }

    return {
      ...event,
      priority: event.priority ?? 0,
      attemptId: requiredString(event.attemptId, 'Combo finisher attemptId'),
      finisherType: normalizeComboFinisherType(event.finisherType),
      fieldBinding: normalizeComboFieldBinding(event.fieldBinding),
      effectAt,
      chance: clamp(chance, 0, 1),
      applications: positiveInteger(event.applications, 'Combo finisher applications'),
      successfulCombos: positiveInteger(event.successfulCombos, 'Combo finisher successfulCombos'),
      ...(parentEventOrder == null ? {} : { parentEventOrder })
    };
  }

  if (event.type === 'combo') {
    const outcome = event.outcome;

    if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) {
      throw new TypeError('Combo outcome is required.');
    }

    return {
      ...event,
      comboId: requiredString(event.comboId, 'Combo comboId'),
      attemptId: requiredString(event.attemptId, 'Combo attemptId'),
      fieldId: requiredString(event.fieldId, 'Combo fieldId'),
      fieldType: normalizeComboFieldType(event.fieldType),
      finisherType: normalizeComboFinisherType(event.finisherType),
      // Reconstruct a full binding object just to validate and then discard
      // everything except .kind — combo events only record how the field was bound.
      bindingKind: normalizeComboFieldBinding(
        event.bindingKind === 'field-id'
          ? { kind: 'field-id', fieldId: event.fieldId }
          : event.bindingKind === 'field-type'
            ? { kind: 'field-type', fieldType: event.fieldType }
            : { kind: event.bindingKind }
      ).kind,
      applicationCount: positiveInteger(event.applicationCount, 'Combo applicationCount')
    };
  }

  if (event.type === 'aura') {
    const duration = Number(event.duration);

    if (!requiredString(event.aura, 'Aura name') || !(duration > 0)) {
      throw new TypeError('Aura events require a positive duration.');
    }

    return { ...event, duration };
  }

  return event;
}

/** Reports whether an event is a scheduler-only combo prediction. */
export function isSchedulerComboPrediction(event: Readonly<Record<string, unknown>>): boolean {
  return event.schedulerPrediction === 'combo-result';
}

/** Creates isolated mutable state for combo resolution. */
export function createGw2ComboRuntimeState(): Gw2ComboRuntimeState {
  return {
    fields: new Map(),
    handledAttemptIds: new Set(),
    deterministicProgress: new Map(),
    warningKeys: new Set()
  };
}

/** Registers an active combo field by its stable field identifier. */
export function registerComboField(state: Gw2ComboRuntimeState, event: ComboFieldEvent): void {
  state.fields.set(event.fieldId, event);
}

function activeAt(field: ComboFieldEvent, at: number): boolean {
  return field.at <= at + EPSILON && field.expiresAt > at + EPSILON;
}

// Expired fields are cleaned up lazily inside boundField, not on every event,
// so they accumulate in state until a finisher actually queries them.
function discardExpiredFields(state: Gw2ComboRuntimeState, at: number): void {
  for (const [fieldId, field] of state.fields) {
    if (field.expiresAt <= at + EPSILON) state.fields.delete(fieldId);
  }
}

function warningLabel(event: ComboFinisherEvent): string {
  return String(event.skillName || event.name || event.source || event.sourceId);
}

function warnOnce(state: Gw2ComboRuntimeState, key: string, message: string, warn: (message: string) => void): void {
  if (state.warningKeys.has(key)) return;
  state.warningKeys.add(key);
  warn(message);
}

function boundField(
  state: Gw2ComboRuntimeState,
  event: ComboFinisherEvent,
  warn: (message: string) => void
): ComboFieldEvent | null {
  discardExpiredFields(state, event.at);
  const label = warningLabel(event);
  const time = event.at.toFixed(3);

  if (event.fieldBinding.kind === 'none') {
    // warnOnUnbound=false suppresses the warning for finishers that are
    // intentionally unbound (e.g. a Whirl that self-manages its field choice).
    if (event.warnOnUnbound === false) return null;
    warnOnce(
      state,
      `none|${label}`,
      `Combo field binding is unspecified for ${label} at ${time}s; no combo resolved.`,
      warn
    );
    return null;
  }

  if (event.fieldBinding.kind === 'field-id') {
    const field = state.fields.get(event.fieldBinding.fieldId);

    if (field && activeAt(field, event.at)) return field;
    warnOnce(
      state,
      `inactive-id|${event.fieldBinding.fieldId}|${label}`,
      `Combo field ${event.fieldBinding.fieldId} is not active for ${label} at ${time}s; no combo resolved.`,
      warn
    );
    return null;
  }

  const binding = event.fieldBinding;

  if (binding.kind !== 'field-type') return null;
  const candidates = [...state.fields.values()]
    .filter((field) => field.fieldType === binding.fieldType && activeAt(field, event.at))
    .sort((left, right) => left.at - right.at);

  if (candidates[0]) return candidates[0];
  warnOnce(
    state,
    `inactive-type|${binding.fieldType}|${label}`,
    `${binding.fieldType} combo field is not active for ${label} at ${time}s; no combo resolved.`,
    warn
  );
  return null;
}

// Accumulates fractional expected procs per unique {field+finisher+outcome} key.
// Progress fires and resets by 1.0 each time it crosses the threshold — this
// spreads proc events evenly across the rotation rather than rounding up or down.
function deterministicSuccess(state: Gw2ComboRuntimeState, event: ComboFinisherEvent, field: ComboFieldEvent): boolean {
  if (event.chance >= 1) return true;

  if (event.chance <= 0) return false;
  const outcome = comboDefinition(field.fieldType, event.finisherType).outcome;
  const key = [field.fieldType, event.finisherType, outcome.kind, outcome.name].join('|');
  const progress = (state.deterministicProgress.get(key) || 0) + event.chance;

  if (progress + EPSILON < 1) {
    state.deterministicProgress.set(key, progress);
    return false;
  }

  state.deterministicProgress.set(key, Math.max(0, progress - 1));
  return true;
}

export interface ResolveComboAttemptOptions {
  readonly stochastic: boolean;
  readonly roll: (probability: number, stream: string) => boolean;
  readonly warn: (message: string) => void;
}

/** Resolves one explicitly bound attempt into zero or more semantic combos. */
export function resolveComboAttempt(
  state: Gw2ComboRuntimeState,
  event: ComboFinisherEvent,
  { stochastic, roll, warn }: ResolveComboAttemptOptions
): readonly ComboEvent[] {
  // Guard against the same attempt being processed twice if the finisher event
  // appears more than once in the event queue.
  if (state.handledAttemptIds.has(event.attemptId)) return [];
  state.handledAttemptIds.add(event.attemptId);
  const field = boundField(state, event, warn);

  if (!field) return [];
  const succeeded = stochastic
    ? roll(event.chance, `gw2.combo:${event.attemptId}`)
    : deterministicSuccess(state, event, field);

  if (!succeeded) return [];

  const definition = comboDefinition(field.fieldType, event.finisherType);
  return Object.freeze(
    Array.from({ length: event.successfulCombos }, (_, index) => ({
      type: 'combo' as const,
      at: event.effectAt,
      source: event.source,
      sourceId: event.sourceId,
      actorType: event.actorType,
      name: definition.outcome.name,
      skillName: event.skillName,
      parentSkillName: event.parentSkillName,
      skillId: event.skillId,
      activationId: event.activationId,
      comboId: `${event.attemptId}:combo:${index + 1}`,
      attemptId: event.attemptId,
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      finisherType: event.finisherType,
      fieldSourceId: field.sourceId,
      fieldSource: field.source,
      fieldOwnerId: field.ownerId,
      fieldOwnerActorType: field.ownerActorType,
      bindingKind: event.fieldBinding.kind,
      applicationCount: event.applications,
      outcome: definition.outcome,
      parentEventOrder: event.parentEventOrder
    }))
  );
}
