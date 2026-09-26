import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { ComboFieldType, ComboFinisherType, ComboFieldSelectionAnchor } from '#gw2/platform/combos/types.js';
import {
  normalizeComboFieldType,
  normalizeComboFinisherType,
  normalizeComboFieldSelectionAnchor
} from '#gw2/platform/combos/events.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Normalizes canonical combo descriptors without observing combat state or predicting outcomes. */
export interface OwnedFieldDescriptor extends UnvalidatedFields {
  readonly ownerId: string;
  readonly fieldType: ComboFieldType;
  readonly startMs: number;
  readonly startAnchor: 'castStart' | 'castEnd' | 'event';
  readonly duration: number;
  readonly inclusiveExpiry?: boolean;
  readonly ownerActorType?: SimulationActorType;
}

export interface OwnedFinisherDescriptor extends UnvalidatedFields {
  readonly ownerId: string;
  readonly finisherType: ComboFinisherType;
  readonly fieldSelectionAnchor?: ComboFieldSelectionAnchor;
  readonly chance: number;
  readonly attempts: number;
  readonly applications: number;
  readonly successfulCombos: number;
}

export function fieldDescriptors(catalog: CanonicalCatalog, event: SimulationEvent): readonly OwnedFieldDescriptor[] {
  const skill = catalog.skillsById.get(event.skillId ?? event.sourceId);
  const descriptors = Array.isArray(event.comboFields)
    ? event.comboFields
    : event.type === 'action' && Array.isArray(skill?.comboFields)
      ? skill.comboFields
      : [];
  return descriptors
    .filter((raw): raw is UnvalidatedFields => Boolean(raw && typeof raw === 'object' && !Array.isArray(raw)))
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

function hasEffectFinishers(effects: readonly UnvalidatedFields[] | undefined): boolean {
  return Boolean(
    effects?.some(
      (effect) =>
        Array.isArray(effect.comboFinishers) ||
        (Array.isArray(effect.ticks) &&
          effect.ticks.some((tick) => Array.isArray((tick as UnvalidatedFields).comboFinishers)))
    )
  );
}

export function finisherDescriptors(
  catalog: CanonicalCatalog,
  event: SimulationEvent
): readonly OwnedFinisherDescriptor[] {
  const skill = catalog.skillsById.get(event.skillId ?? event.sourceId);
  let descriptors: readonly Readonly<UnvalidatedFields>[] = [];
  if (Array.isArray(event.comboFinishers)) {
    descriptors = event.comboFinishers;
  } else if (
    Array.isArray(skill?.comboFinishers) &&
    !hasEffectFinishers(skill.effects as readonly UnvalidatedFields[] | undefined)
  ) {
    const sourceMatches = event.sourceId === skill.id;
    const actionWithoutStrikes = event.type === 'action' && !skill.effects?.some((effect) => effect.type === 'strike');
    const damagingPacket = event.type === 'damage' && Number(event.coefficient || 0) > 0;
    if (sourceMatches && (actionWithoutStrikes || damagingPacket)) {
      descriptors = skill.comboFinishers;
    }
  }

  return descriptors
    .filter((raw): raw is UnvalidatedFields => Boolean(raw && typeof raw === 'object' && !Array.isArray(raw)))
    .filter((raw) => String(raw.ownerId || '').length > 0)
    .map((raw) => ({
      ...raw,
      ownerId: String(raw.ownerId),
      finisherType: normalizeComboFinisherType(raw.finisherType ?? raw.type),
      fieldSelectionAnchor: normalizeComboFieldSelectionAnchor(raw.fieldSelectionAnchor),
      chance: boundedNumber(raw.chance ?? 1, 1, 0, 1),
      attempts: Math.max(1, Math.trunc(Number(raw.attempts ?? 1))),
      applications: Math.max(1, Math.trunc(Number(raw.applications ?? 1))),
      successfulCombos: Math.max(1, Math.trunc(Number(raw.successfulCombos ?? 1)))
    }));
}

export function fieldAt(event: SimulationEvent, descriptor: OwnedFieldDescriptor) {
  const baseAt = descriptor.startAnchor === 'castEnd' ? Number(event.endsAt ?? event.at) : event.at;
  return baseAt + descriptor.startMs / 1000;
}
