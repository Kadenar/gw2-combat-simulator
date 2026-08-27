import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { enqueueGw2OwnedComboFinisher } from '../../../../platform/gw2/resolver/combo-resolution.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '../../core/profiles.js';
import { queueBuff } from '../../core/shared.js';
import {
  holosmithEventMetadata,
  holosmithHeatSnapshotFromEvent,
  holosmithHeatTier,
  holosmithProfileStrikeFactor
} from './heat-tiers.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { EngineerResolverContext } from '../../types.js';
import type { HolosmithResolverEvent } from './heat-tiers.js';

// Prime Light Beam snapshots heat on activation: above 50 creates ten one-second
// field pulses, while ECSU above 100 enhances their damage and burn duration.
function handlePrimeLightBeamField(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  if (tier === 'base') return;
  const enhancedCapacityTier = tier === 'enhanced';
  const packets = Math.max(
    0,
    Math.trunc(engineerBalanceValue(context, PROFILE.primeLightBeamHeatTier, 'packetCount', 10))
  );
  const interval = Math.max(0, engineerBalanceValue(context, PROFILE.primeLightBeamHeatTier, 'packetInterval', 1));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.primeLightBeamHeatTier, snapshot);
  const conditionBaseDurationFactor = enhancedCapacityTier
    ? engineerBalanceValue(context, PROFILE.primeLightBeamHeatTier, 'enhancedConditionBaseDurationFactor', 1.5)
    : 1;
  for (let pulse = 0; pulse < packets; pulse += 1) {
    const at = event.at + pulse * interval;
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Field Damage',
      skillName: event.skillName,
      coefficient: engineerBalanceEffectValue(context, PROFILE.primeLightBeamHeatTier, 'strike', 'coefficient', 0.5),
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
      stacks: engineerBalanceEffectValue(context, PROFILE.primeLightBeamHeatTier, 'condition', 'stacks', 1),
      duration: engineerBalanceEffectValue(context, PROFILE.primeLightBeamHeatTier, 'condition', 'duration', 3),
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

// Laser Disk: 12 pulses at base heat, 18 pulses above 50 heat; one pulse every 0.52 s.
function handleLaserDisk(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  const enhancedCapacityTier = tier === 'enhanced';
  const pulses = Math.max(
    0,
    Math.trunc(
      engineerBalanceValue(
        context,
        PROFILE.laserDiskHeatTier,
        tier === 'base' ? 'basePacketCount' : 'highPacketCount',
        tier === 'base' ? 12 : 18
      )
    )
  );
  const interval = Math.max(0, engineerBalanceValue(context, PROFILE.laserDiskHeatTier, 'packetInterval', 0.52));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.laserDiskHeatTier, snapshot);
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const at = event.at + (pulse + 1) * interval;
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Laser Disk',
      skillName: event.skillName,
      coefficient: engineerBalanceEffectValue(context, PROFILE.laserDiskHeatTier, 'strike', 'coefficient', 0.5),
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
      stacks: engineerBalanceEffectValue(context, PROFILE.laserDiskHeatTier, 'condition', 'stacks', 1),
      duration: engineerBalanceEffectValue(context, PROFILE.laserDiskHeatTier, 'condition', 'duration', 2),
      applicationIndex: pulse + 1,
      totalApplications: pulses,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId
    });
  }
}

// Launch Wall: 1 wall at base heat, 3 walls above 50 heat; all walls share the same timestamp.
function handleLaunchWall(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  const enhancedCapacityTier = tier === 'enhanced';
  const walls = Math.max(
    0,
    Math.trunc(
      engineerBalanceValue(
        context,
        PROFILE.launchWallHeatTier,
        tier === 'base' ? 'basePacketCount' : 'highPacketCount',
        tier === 'base' ? 1 : 3
      )
    )
  );
  const at = event.at + Math.max(0, engineerBalanceValue(context, PROFILE.launchWallHeatTier, 'initialDelay', 0.48));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.launchWallHeatTier, snapshot);
  for (let wall = 0; wall < walls; wall += 1) {
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Launch Wall',
      skillName: event.skillName,
      coefficient: engineerBalanceEffectValue(context, PROFILE.launchWallHeatTier, 'strike', 'coefficient', 1.5),
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
      stacks: engineerBalanceEffectValue(context, PROFILE.launchWallHeatTier, 'condition', 'stacks', 3),
      duration: engineerBalanceEffectValue(context, PROFILE.launchWallHeatTier, 'condition', 'duration', 5),
      applicationIndex: wall + 1,
      totalApplications: walls,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId
    });
  }
}

// Resolves the heat-scaled boon emitted only by Holosmith's Radiant Arc variant.
function handleRadiantArcQuickness(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  queueBuff(context, event, {
    name: 'Radiant Arc - quickness',
    kind: 'quickness',
    stacks: 1,
    duration: Math.max(0, Number(event.duration ?? 2))
  });
}

// Materializes every heat-granted blade as its own strike, bleed, and projectile finisher.
function handleRefractionCutterExtraBlades(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const extraBlades = Math.max(0, Math.trunc(Number(holosmithEventMetadata(event).extraBlades || 0)));
  const delay = Math.max(0, engineerBalanceValue(context, PROFILE.refractionCutterHeatTier, 'initialDelay', 0.36));
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + delay;
    const damage = enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Refraction Cutter Blade',
      skillName: event.skillName,
      coefficient: engineerBalanceEffectValue(context, PROFILE.refractionCutterHeatTier, 'strike', 'coefficient', 0.4),
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
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: 'Bleeding',
      stacks: engineerBalanceEffectValue(context, PROFILE.refractionCutterHeatTier, 'condition', 'stacks', 1),
      duration: engineerBalanceEffectValue(context, PROFILE.refractionCutterHeatTier, 'condition', 'duration', 4),
      applicationIndex: blade + 2,
      totalApplications: extraBlades + 1,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId
    });
  }
}

export const holosmithResolverEventHandlers = Object.freeze({
  'engineer.prime-light-beam-field': handlePrimeLightBeamField,
  'engineer.laser-disk': handleLaserDisk,
  'engineer.launch-wall': handleLaunchWall,
  'engineer.radiant-arc-quickness': handleRadiantArcQuickness,
  'engineer.refraction-cutter-extra-blades': handleRefractionCutterExtraBlades
});
