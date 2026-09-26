import { canonicalTime } from '#kernel/core/clock.js';
import { fieldDescriptors, finisherDescriptors, fieldAt } from '#gw2/platform/combos/descriptors.js';
import { comboCombatMetadata } from '#gw2/platform/combos/definitions.js';
import { isComboFieldActiveAt, selectComboFieldForFinisher } from '#gw2/platform/combos/events.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { ComboFieldBinding, ComboFieldType } from '#gw2/platform/combos/types.js';

/** Bind fields only when an authored finisher reaches its timestamp, using executed field registrations. */
export function bindRuntimeCombo(runtime: Gw2Runtime, event: Gw2ResolverEvent): Gw2ResolverEvent {
  if (event.type !== 'combo_finisher' || !event.comboAllowRebind) return event;
  const candidates = [...runtime.combo.fields.values()].filter(
    (field) =>
      field.ownerId === event.comboOwnerId &&
      isComboFieldActiveAt(field, event.at, Number(event.fieldSelectionAt ?? event.at)) &&
      (event.comboExcludeOwnField !== true || field.activationId !== event.activationId)
  );
  const { field, ambiguous } = selectComboFieldForFinisher(candidates, {
    preferredFieldTypes: event.comboPreferredFieldTypes as readonly ComboFieldType[] | undefined,
    ambiguousFieldSelection: event.comboAmbiguousFieldSelection === 'oldest' ? 'oldest' : 'none'
  });
  return {
    ...event,
    fieldBinding: field ? { kind: 'field-id', fieldId: field.fieldId } : { kind: 'none' },
    warnOnUnbound: ambiguous && !field
  };
}

/** Emit field registrations and attempts from actual actions/impacts; the shared resolver alone rolls and applies combos. */
export function produceRuntimeCombos(runtime: Gw2Runtime, catalog: CanonicalCatalog, event: Gw2ResolverEvent): void {
  if (event.cancelled || !['action', 'damage', 'condition', 'control', 'buff'].includes(event.type)) return;
  if (!Array.isArray(event.comboFields) || Number(event.hitIndex ?? event.applicationIndex ?? 1) === 1) {
    fieldDescriptors(catalog, event).forEach((descriptor, index) => {
      const at = canonicalTime(fieldAt(event, descriptor));
      runtime.emitDerived(event, {
        ...comboCombatMetadata(event),
        type: 'combo_field',
        at,
        source: event.source,
        sourceId: event.sourceId,
        actorType: event.actorType,
        skillId: event.skillId,
        skillName: event.skillName,
        fieldId: `${descriptor.ownerId}:${event.activationId ?? event.eventOrder}:field:${index + 1}`,
        fieldType: descriptor.fieldType,
        expiresAt: canonicalTime(at + descriptor.duration),
        ownerId: descriptor.ownerId,
        ownerActorType: descriptor.ownerActorType ?? event.actorType,
        inclusiveExpiry: descriptor.inclusiveExpiry,
        comboBindingPriority: descriptor.comboBindingPriority
      });
    });
  }

  finisherDescriptors(catalog, event).forEach((descriptor, index) => {
    const at = event.type === 'action' ? Number(event.endsAt ?? event.at) : event.at;
    const action =
      descriptor.fieldSelectionAnchor === 'castStart'
        ? event.type === 'action'
          ? event
          : runtime.history.find(
              (candidate) => candidate.type === 'action' && candidate.activationId === event.activationId
            )
        : undefined;
    if (descriptor.fieldSelectionAnchor === 'castStart' && !action)
      throw new TypeError('Cast-start combo requires an owning action.');
    for (let attempt = 1; attempt <= descriptor.attempts; attempt++) {
      const packet = descriptor.finisherType === 'Projectile' ? `:${event.eventOrder ?? event.hitIndex}` : '';
      runtime.emitDerived(event, {
        ...comboCombatMetadata(event),
        type: 'combo_finisher',
        at,
        source: event.source,
        sourceId: event.sourceId,
        actorType: event.actorType,
        skillId: event.skillId,
        skillName: event.skillName,
        attemptId: `${event.activationId ?? event.eventOrder}:${descriptor.finisherType}:${descriptor.attemptGroup ?? 'skill'}:${index}:${attempt}${packet}`,
        finisherType: descriptor.finisherType,
        fieldBinding: (descriptor.fieldBinding ?? { kind: 'none' }) as ComboFieldBinding,
        comboAllowRebind: descriptor.fieldBinding == null,
        comboOwnerId: descriptor.ownerId,
        comboPreferredFieldTypes: descriptor.preferredFieldTypes,
        comboAmbiguousFieldSelection: descriptor.ambiguousFieldSelection,
        comboExcludeOwnField: descriptor.excludeOwnField,
        fieldSelectionAt: action?.at,
        effectAt: Math.max(at, Number(descriptor.effectAt ?? at + Number(descriptor.effectDelay ?? 0))),
        chance: descriptor.chance,
        applications: descriptor.applications,
        successfulCombos: descriptor.successfulCombos
      });
    }
  });
}
