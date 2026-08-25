import { holosmithState } from './state.js';
import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { enqueueGw2OwnedComboFinisher } from '../../../../platform/gw2/resolver/combo-resolution.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { queueBuff } from '../../core/shared.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '../../types.js';

// Prime Light Beam field: 10 pulses at 1-second intervals, active only above 50 heat.
// enhancedCapacityTier gates the bonus duration added by the modifier rules in rules.ts.
function handlePrimeLightBeamField(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const heat = Number(holosmithState.from(context).heat || 0);
  if (heat <= 50) return;
  const enhancedCapacityTier = heat >= 100 && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  for (let pulse = 0; pulse < 10; pulse += 1) {
    const at = event.at + pulse;
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Field Damage',
      skillName: event.skillName,
      coefficient: 0.5,
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: 10,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Unequipped',
      damageKind: 'explosion',
      enhancedCapacityTier
    });
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} — Burning`,
      skillName: event.skillName,
      condition: 'Burning',
      stacks: 1,
      duration: 3,
      applicationIndex: pulse + 1,
      totalApplications: 10,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      enhancedCapacityTier
    });
  }
}

// Laser Disk: 12 pulses at base heat, 18 pulses above 50 heat; one pulse every 0.52 s.
function handleLaserDisk(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const heat = Number(holosmithState.from(context).heat || 0);
  const pulses = heat > 50 ? 18 : 12;
  const enhancedCapacityTier = heat >= 100 && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const at = event.at + (pulse + 1) * 0.52;
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Laser Disk',
      skillName: event.skillName,
      coefficient: 0.5,
      hits: 1,
      hitIndex: pulse + 1,
      totalHits: pulses,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Utility',
      enhancedCapacityTier
    });
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} - Bleeding`,
      skillName: event.skillName,
      condition: 'Bleeding',
      stacks: 1,
      duration: 2,
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
function handleLaunchWall(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const heat = Number(holosmithState.from(context).heat || 0);
  const walls = heat > 50 ? 3 : 1;
  const enhancedCapacityTier = heat >= 100 && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  const at = event.at + 0.48;
  for (let wall = 0; wall < walls; wall += 1) {
    enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Launch Wall',
      skillName: event.skillName,
      coefficient: 1.5,
      hits: 1,
      hitIndex: wall + 1,
      totalHits: walls,
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'player',
      skillId: event.skillId,
      skillWeapon: 'Utility',
      damageKind: 'explosion',
      enhancedCapacityTier
    });
    enqueueOrdered(context.queue, {
      type: 'condition',
      at,
      name: `${event.skillName} - Vulnerability`,
      skillName: event.skillName,
      condition: 'Vulnerability',
      stacks: 3,
      duration: 5,
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
function handleRadiantArcQuickness(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  queueBuff(context, event, {
    name: 'Radiant Arc - quickness',
    kind: 'quickness',
    stacks: 1,
    duration: Math.max(0, Number(event.duration ?? 2))
  });
}

// Materializes every heat-granted blade as its own strike, bleed, and projectile finisher.
function handleRefractionCutterExtraBlades(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const extraBlades = Math.max(0, Math.trunc(Number(event.extraBlades || 0)));
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + 0.36;
    const damage = enqueueOrdered(context.queue, {
      type: 'damage',
      at,
      name: 'Refraction Cutter Blade',
      skillName: event.skillName,
      coefficient: 0.4,
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
      stacks: 1,
      duration: 4,
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
