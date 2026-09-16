/** Reaper-specific summon-owned finisher resolution. */
import { enqueueGw2OwnedComboFinisher } from '#gw2/platform/resolver/combo-resolution.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

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
      attemptId: `${event.activationId || event.sourceId}:projectile:${event.eventOrder || event.at}:${index + 1}`,
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
