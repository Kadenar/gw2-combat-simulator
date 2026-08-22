/** Reaper-specific combo field assumptions and summon-owned finisher resolution. */
import { enqueueGw2OwnedComboFinisher } from '../../../../platform/gw2/resolver/combo-resolution.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent
} from '../../types.js';

// Far-future sentinel so the assumption field is never reclaimed during a normal simulation run.
const ASSUMED_FIELD_EXPIRES_AT = 1_000_000_000;

/** Emits the explicit field selected by the Reaper permanent-field assumption. */
export function ensurePermanentIceFieldAssumption(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent
): void {
  // Guard is idempotent: the field must be emitted only once regardless of how many events trigger the hook.
  if (
    !context.config.professionAssumptions?.permanentIceField ||
    context.events.some(
      (candidate) =>
        candidate.type === 'combo_field' && candidate.fieldId === 'necromancer:assumption:permanent-ice-field'
    )
  ) {
    return;
  }

  context.emitDerived(event, {
    type: 'combo_field',
    at: event.at,
    source: 'Permanent Ice Field assumption',
    sourceId: 'necromancer.assumption.permanent-ice-field',
    actorType: 'effect',
    skillName: 'Permanent Ice Field assumption',
    fieldId: 'necromancer:assumption:permanent-ice-field',
    fieldType: 'Ice',
    expiresAt: ASSUMED_FIELD_EXPIRES_AT,
    ownerId: 'necromancer',
    ownerActorType: 'player',
    // Priority 1 ensures this assumption field wins over any zero-priority real fields when both overlap.
    comboBindingPriority: 1
  });
}

/**
 * Summon attacks become finishers only after their resolver generation guards
 * pass, so dead or replaced minions cannot create authoritative combo effects.
 */
export function resolveSummonOwnedComboFinisher(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (event.type !== 'damage' || event.actorType !== 'summon' || !(Number(event.coefficient) > 0)) {
    return;
  }

  const descriptors = Array.isArray(event.comboFinishers) ? event.comboFinishers : [];
  descriptors.forEach((descriptor, index) => {
    if (
      descriptor.ownerId !== 'necromancer' ||
      String(descriptor.finisherType).toLowerCase() !== 'projectile' ||
      !(Number(descriptor.chance ?? 1) > 0)
    ) {
      return;
    }

    enqueueGw2OwnedComboFinisher(context, event, {
      ownerId: 'necromancer',
      // index+1 disambiguates multiple finishers on the same hit (e.g. multi-projectile summon attacks).
      attemptId: `${event.activationId || event.sourceId}:projectile:${event.__order || event.at}:${index + 1}`,
      finisherType: 'Projectile',
      at: event.at,
      effectAt: event.at,
      chance: Number(descriptor.chance ?? 1),
      applications: Number(descriptor.applications ?? 1),
      successfulCombos: Number(descriptor.successfulCombos ?? 1),
      preferredFieldTypes: descriptor.preferredFieldTypes,
      ambiguousFieldSelection: descriptor.ambiguousFieldSelection === 'oldest' ? 'oldest' : 'none'
    });
  });
}
