import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { enqueueGw2OwnedComboFinisher } from '#gw2/platform/resolver/combo-resolution.js';
import { queueBuff } from '#gw2/professions/engineer/core/mechanics/state-helpers.js';
import {
  holosmithEventMetadata,
  holosmithHeatSnapshotFromEvent,
  holosmithHeatTier,
  holosmithProfileStrikeFactor
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import type { EngineerResolverContext } from '#gw2/professions/engineer/types.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';

/**
 * Materializes Prime Light Beam's ten one-second field pulses above 50 heat,
 * with ECSU enhancement above 100 heat taken from the activation snapshot.
 */
function handlePrimeLightBeamField(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  // Derive all packet tuning from the captured activation tier before expanding the delayed field.
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  if (tier === 'base') return;
  const enhancedCapacityTier = tier === 'enhanced';
  const packets = Math.max(
    0,
    Math.trunc(balanceProfileValueFromContext(context, PROFILE.primeLightBeamHeatTier, 'packetCount', 10))
  );
  const interval = Math.max(
    0,
    balanceProfileValueFromContext(context, PROFILE.primeLightBeamHeatTier, 'packetInterval', 1)
  );
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.primeLightBeamHeatTier, snapshot);
  const strike = balanceProfileEffectFromContext(context, PROFILE.primeLightBeamHeatTier, 'strike');
  const condition = balanceProfileEffectFromContext(context, PROFILE.primeLightBeamHeatTier, 'condition');
  const conditionBaseDurationFactor = enhancedCapacityTier
    ? balanceProfileValueFromContext(
        context,
        PROFILE.primeLightBeamHeatTier,
        'enhancedConditionBaseDurationFactor',
        1.5
      )
    : 1;
  // Each field pulse emits a paired explosion and burning application at the same timestamp.
  for (let pulse = 0; pulse < packets; pulse += 1) {
    const at = event.at + pulse * interval;
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Field Damage',
      skillName: event.skillName,
      coefficient: balanceProfileValue(strike, 'coefficient', 0.5),
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: packets,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Unequipped',
      damageKind: 'explosion',
      enhancedCapacityTier,
      holosmithStrikeFactor: strikeFactor
    });
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} — Burning`,
      skillName: event.skillName,
      condition: 'Burning',
      stacks: balanceProfileValue(condition, 'stacks', 1),
      duration: balanceProfileValue(condition, 'duration', 3),
      applicationIndex: pulse + 1,
      totalApplications: packets,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      enhancedCapacityTier,
      holosmithConditionBaseDurationFactor: conditionBaseDurationFactor
    });
  }
}

/** Materializes Laser Disk's 12 base or 18 high-heat strike-and-bleed pulses at 0.52-second intervals. */
function handleLaserDisk(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  // Resolve the heat-dependent cadence once so every delayed packet preserves the activation tier.
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  const enhancedCapacityTier = tier === 'enhanced';
  const pulses = Math.max(
    0,
    Math.trunc(
      balanceProfileValueFromContext(
        context,
        PROFILE.laserDiskHeatTier,
        tier === 'base' ? 'basePacketCount' : 'highPacketCount',
        tier === 'base' ? 12 : 18
      )
    )
  );
  const interval = Math.max(
    0,
    balanceProfileValueFromContext(context, PROFILE.laserDiskHeatTier, 'packetInterval', 0.52)
  );
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.laserDiskHeatTier, snapshot);
  const strike = balanceProfileEffectFromContext(context, PROFILE.laserDiskHeatTier, 'strike');
  const condition = balanceProfileEffectFromContext(context, PROFILE.laserDiskHeatTier, 'condition');
  // Expand the disk into paired strike and bleed packets on successive cadence boundaries.
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const at = event.at + (pulse + 1) * interval;
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Laser Disk',
      skillName: event.skillName,
      coefficient: balanceProfileValue(strike, 'coefficient', 0.5),
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: pulses,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Utility',
      enhancedCapacityTier,
      holosmithStrikeFactor: strikeFactor
    });
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: 'Bleeding',
      stacks: balanceProfileValue(condition, 'stacks', 1),
      duration: balanceProfileValue(condition, 'duration', 2),
      applicationIndex: pulse + 1,
      totalApplications: pulses,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId
    });
  }
}

/** Materializes one base or three high-heat Launch Walls at one shared delayed impact timestamp. */
function handleLaunchWall(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  // Resolve wall count, delay, and strike scaling from the captured activation tier.
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  const enhancedCapacityTier = tier === 'enhanced';
  const walls = Math.max(
    0,
    Math.trunc(
      balanceProfileValueFromContext(
        context,
        PROFILE.launchWallHeatTier,
        tier === 'base' ? 'basePacketCount' : 'highPacketCount',
        tier === 'base' ? 1 : 3
      )
    )
  );
  const at =
    event.at + Math.max(0, balanceProfileValueFromContext(context, PROFILE.launchWallHeatTier, 'initialDelay', 0.48));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.launchWallHeatTier, snapshot);
  const strike = balanceProfileEffectFromContext(context, PROFILE.launchWallHeatTier, 'strike');
  const condition = balanceProfileEffectFromContext(context, PROFILE.launchWallHeatTier, 'condition');
  // Every wall lands together and owns one explosion plus one vulnerability application.
  for (let wall = 0; wall < walls; wall += 1) {
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Launch Wall',
      skillName: event.skillName,
      coefficient: balanceProfileValue(strike, 'coefficient', 1.5),
      hits: 1,
      hitIndex: wall + 1,
      totalHits: walls,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Utility',
      damageKind: 'explosion',
      enhancedCapacityTier,
      holosmithStrikeFactor: strikeFactor
    });
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} - Vulnerability`,
      skillName: event.skillName,
      condition: 'Vulnerability',
      stacks: balanceProfileValue(condition, 'stacks', 3),
      duration: balanceProfileValue(condition, 'duration', 5),
      applicationIndex: wall + 1,
      totalApplications: walls,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId
    });
  }
}

/** Resolves the heat-scaled Quickness packet emitted by Holosmith's Radiant Arc variant. */
function handleRadiantArcQuickness(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  queueBuff(context, event, {
    name: 'Radiant Arc - quickness',
    kind: 'quickness',
    stacks: 1,
    duration: Math.max(0, Number(event.duration ?? 2))
  });
}

/** Materializes every heat-granted Refraction Cutter blade as a strike, bleed, and projectile finisher. */
function handleRefractionCutterExtraBlades(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const extraBlades = Math.max(0, Math.trunc(Number(holosmithEventMetadata(event).extraBlades || 0)));
  const delay = Math.max(
    0,
    balanceProfileValueFromContext(context, PROFILE.refractionCutterHeatTier, 'initialDelay', 0.36)
  );
  const strike = balanceProfileEffectFromContext(context, PROFILE.refractionCutterHeatTier, 'strike');
  const condition = balanceProfileEffectFromContext(context, PROFILE.refractionCutterHeatTier, 'condition');
  // Materialize each extra blade independently so its strike can own a matching combo attempt and bleed.
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + delay;
    const damage = enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Refraction Cutter Blade',
      skillName: event.skillName,
      coefficient: balanceProfileValue(strike, 'coefficient', 0.4),
      hits: 1,
      hitIndex: blade + 2,
      totalHits: extraBlades + 1,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Sword',
      projectile: true,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Projectile',
          chance: 1,
          preferredFieldTypes: ['Fire'],
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
    // Register the owned finisher from the queued strike rather than emitting an uncorrelated combo event.
    enqueueGw2OwnedComboFinisher(context, damage, {
      ownerId: 'engineer',
      attemptId: `${event.activationId || event.sourceId}:refraction-cutter:projectile:${blade + 2}`,
      finisherType: 'Projectile',
      at,
      effectAt: at,
      chance: 1,
      preferredFieldTypes: ['Fire'],
      ambiguousFieldSelection: 'oldest'
    });
    // Pair the blade's bleed with the same delayed impact and application index.
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: 'Bleeding',
      stacks: balanceProfileValue(condition, 'stacks', 1),
      duration: balanceProfileValue(condition, 'duration', 4),
      applicationIndex: blade + 2,
      totalApplications: extraBlades + 1,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId
    });
  }
}

/** Routes Holosmith custom resolver events to their heat-aware packet materializers. */
export const holosmithResolverEventHandlers = Object.freeze({
  'engineer.prime-light-beam-field': handlePrimeLightBeamField,
  'engineer.laser-disk': handleLaserDisk,
  'engineer.launch-wall': handleLaunchWall,
  'engineer.radiant-arc-quickness': handleRadiantArcQuickness,
  'engineer.refraction-cutter-extra-blades': handleRefractionCutterExtraBlades
});
