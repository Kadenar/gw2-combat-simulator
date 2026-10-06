import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import { canonicalTime } from '#kernel/core/clock.js';

import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { ACTOR_TYPES, type SimulationActorType } from '#gw2/platform/events/actors.js';
import { COMBO_FIELD_TYPES, COMBO_FINISHER_TYPES } from '#gw2/platform/combos/types.js';
import type {
  ComboFieldBinding,
  ComboFieldSelectionAnchor,
  ComboFieldType,
  ComboFinisherType
} from '#gw2/platform/combos/types.js';
import { clamp } from '#kernel/core/numeric.js';

/**
 * Combo vocabulary and event validation: normalizes field, finisher, and selection-anchor values for catalog assembly,
 * and validates combo field, finisher, combo, and aura events before the engine freezes them.
 */

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

/** Finishers select at their event by default; a cast-start anchor opens an earlier eligibility window. */
export function normalizeComboFieldSelectionAnchor(value: unknown): ComboFieldSelectionAnchor {
  if (value == null || value === 'event') return 'event';
  if (value === 'castStart') return 'castStart';
  throw new TypeError(`Invalid combo fieldSelectionAnchor: ${String(value)}.`);
}

/** Normalizes and validates a finisher-to-field binding declaration. */
function normalizeComboFieldBinding(value: unknown): ComboFieldBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Combo finisher fieldBinding is required.');
  }

  const binding = value as UnvalidatedFields;
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
export function prepareGw2ComboEvent(event: SimulationEventBase): SimulationEventBase {
  if (event.type === 'combo_field') {
    const at = event.at;
    const expiresAt = Number(event.expiresAt);
    const comboBindingPriority = event.comboBindingPriority == null ? null : Number(event.comboBindingPriority);
    if (!Number.isFinite(expiresAt) || !(canonicalTime(expiresAt) > canonicalTime(at))) {
      throw new TypeError('Combo field expiresAt must be later than at.');
    }

    if (comboBindingPriority != null && (!Number.isFinite(comboBindingPriority) || comboBindingPriority < 0)) {
      throw new TypeError('Combo field comboBindingPriority must be a non-negative finite number.');
    }

    // Combo ownership uses the same vocabulary as every other simulation event.
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
      expiresAt: canonicalTime(expiresAt),
      ownerId: requiredString(event.ownerId, 'Combo field ownerId'),
      ...(comboBindingPriority == null ? {} : { comboBindingPriority })
    };
  }

  if (event.type === 'combo_finisher') {
    const at = event.at;
    const fieldSelectionAt = event.fieldSelectionAt == null ? null : Number(event.fieldSelectionAt);
    if (fieldSelectionAt != null && (!Number.isFinite(fieldSelectionAt) || fieldSelectionAt > at)) {
      throw new TypeError('Combo finisher fieldSelectionAt must be finite and must not follow at.');
    }

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
      // Finishers and their derived combo chain settle after fields (-1) but before the originating damage (0).
      priority: event.priority ?? -0.5,
      attemptId: requiredString(event.attemptId, 'Combo finisher attemptId'),
      finisherType: normalizeComboFinisherType(event.finisherType),
      fieldBinding: normalizeComboFieldBinding(event.fieldBinding),
      ...(fieldSelectionAt == null ? {} : { fieldSelectionAt }),
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
