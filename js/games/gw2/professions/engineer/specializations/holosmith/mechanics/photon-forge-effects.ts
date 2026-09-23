import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { enqueueGw2OwnedComboFinisher } from '#gw2/platform/resolver/combo-resolution.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { queueBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import {
  holosmithEventMetadata,
  holosmithHeatSnapshotFromEvent,
  holosmithHeatTier,
  holosmithProfileStrikeFactor
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import type { EngineerResolverContext } from '#gw2/professions/engineer/types.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';

/** Replaces Lens charges only when the Forge transition's grant reaches the resolver. */
function handleSolarFocusingLens(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const state = holosmithState.from(context);
  // Lens keeps its inclusive final-hit policy on the temporary-effect expiry tick.
  state.solarFocusingLens = {
    ...grantCharges(Number(event.stacks), gw2EffectExpiresAt(event.at, Number(event.duration))),
    readyAt: event.at
  };
}

/** Spends Lens charges in impact order, including strikes materialized by resolver handlers. */
export function consumeSolarFocusingLens(
  context: EngineerResolverContext,
  event: HolosmithResolverEvent
): { solarFocusingLens: true } | void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  const state = holosmithState.from(context);
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
  const condition = requireEffect(solarFocusingLensProfile, 'condition', 'Burning');
  if (!condition) return;
  // Lens cannot activate before its grant; zero-ICD consumption does not enforce readyAt.
  if (event.at < (state.solarFocusingLens.readyAt ?? 0) || !consumeCharge(state.solarFocusingLens, event.at, 0, true))
    return;
  if (condition) {
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.SOLAR_FOCUSING_LENS,
        actorType: 'player',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Solar Focusing Lens — Burning',
        condition: String(condition.condition),
        stacks: Number(condition.stacks),
        duration: Number(condition.duration)
      })
    );
  }

  return { solarFocusingLens: true };
}

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
  const primeLightBeamHeatTierProfile = requireBalanceProfileFromContext(context, PROFILE.primeLightBeamHeatTier);
  const packets = Math.max(0, Math.trunc(balanceProfileNumber(primeLightBeamHeatTierProfile, 'packetCount')));
  const interval = Math.max(0, balanceProfileNumber(primeLightBeamHeatTierProfile, 'packetInterval'));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.primeLightBeamHeatTier, snapshot);
  const strike = requireEffect(primeLightBeamHeatTierProfile, 'strike', 'Prime Light Beam Heat Tier');
  const condition = requireEffect(primeLightBeamHeatTierProfile, 'condition', 'Burning');
  const conditionBaseDurationFactor = enhancedCapacityTier
    ? balanceProfileNumber(primeLightBeamHeatTierProfile, 'enhancedConditionBaseDurationFactor')
    : 1;
  // Each field pulse emits a paired explosion and burning application at the same timestamp.
  for (let pulse = 0; pulse < packets; pulse += 1) {
    const at = event.at + pulse * interval;
    if (strike) {
      context.queue.enqueue(
        buildResolverStrike({
          at,
          name: 'Field Damage',
          skillName: event.skillName,
          coefficient: effectNumber(primeLightBeamHeatTierProfile, strike, 'coefficient'),

          hitIndex: pulse + 1,
          totalHits: packets,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId,
          skillWeapon: 'Unequipped',
          damageKind: 'explosion',
          holosmithStrikeFactor: strikeFactor
        })
      );
    }

    if (condition) {
      context.queue.enqueue(
        buildResolverCondition({
          at,
          name: `${event.skillName} — Burning`,
          skillName: event.skillName,
          condition: String(condition.condition),
          stacks: Number(condition.stacks),
          duration: Number(condition.duration),
          applicationIndex: pulse + 1,
          totalApplications: packets,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId,
          holosmithConditionBaseDurationFactor: conditionBaseDurationFactor
        })
      );
    }
  }
}

/** Materializes Laser Disk's 12 base or 18 high-heat strike-and-bleed pulses at 0.52-second intervals. */
function handleLaserDisk(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  // Resolve the heat-dependent cadence once so every delayed packet preserves the activation tier.
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  const laserDiskHeatTierProfile = requireBalanceProfileFromContext(context, PROFILE.laserDiskHeatTier);
  const pulses = Math.max(
    0,
    Math.trunc(balanceProfileNumber(laserDiskHeatTierProfile, tier === 'base' ? 'basePacketCount' : 'highPacketCount'))
  );
  const interval = Math.max(0, balanceProfileNumber(laserDiskHeatTierProfile, 'packetInterval'));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.laserDiskHeatTier, snapshot);
  const strike = requireEffect(laserDiskHeatTierProfile, 'strike', 'Laser Disk Heat Tier');
  const condition = requireEffect(laserDiskHeatTierProfile, 'condition', 'Bleeding');
  // Expand the disk into paired strike and bleed packets on successive cadence boundaries.
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const at = event.at + (pulse + 1) * interval;
    if (strike) {
      context.queue.enqueue(
        buildResolverStrike({
          at,
          name: 'Laser Disk',
          skillName: event.skillName,
          coefficient: effectNumber(laserDiskHeatTierProfile, strike, 'coefficient'),

          hitIndex: pulse + 1,
          totalHits: pulses,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId,
          skillWeapon: 'Utility',
          holosmithStrikeFactor: strikeFactor
        })
      );
    }

    if (condition) {
      context.queue.enqueue(
        buildResolverCondition({
          at,
          name: `${event.skillName} - Bleeding`,
          skillName: event.skillName,
          condition: String(condition.condition),
          stacks: Number(condition.stacks),
          duration: Number(condition.duration),
          applicationIndex: pulse + 1,
          totalApplications: pulses,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId
        })
      );
    }
  }
}

/** Materializes one base or three high-heat Launch Walls at one shared delayed impact timestamp. */
function handleLaunchWall(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  // Resolve wall count, delay, and strike scaling from the captured activation tier.
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot);
  const launchWallHeatTierProfile = requireBalanceProfileFromContext(context, PROFILE.launchWallHeatTier);
  const walls = Math.max(
    0,
    Math.trunc(balanceProfileNumber(launchWallHeatTierProfile, tier === 'base' ? 'basePacketCount' : 'highPacketCount'))
  );
  const at = event.at + Math.max(0, balanceProfileNumber(launchWallHeatTierProfile, 'initialDelay'));
  const strikeFactor = holosmithProfileStrikeFactor(context, PROFILE.launchWallHeatTier, snapshot);
  const strike = requireEffect(launchWallHeatTierProfile, 'strike', 'Launch Wall Heat Tier');
  const condition = requireEffect(launchWallHeatTierProfile, 'condition', 'Vulnerability');
  // Every wall lands together and owns one explosion plus one vulnerability application.
  for (let wall = 0; wall < walls; wall += 1) {
    if (strike) {
      context.queue.enqueue(
        buildResolverStrike({
          at,
          name: 'Launch Wall',
          skillName: event.skillName,
          coefficient: effectNumber(launchWallHeatTierProfile, strike, 'coefficient'),

          hitIndex: wall + 1,
          totalHits: walls,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId,
          skillWeapon: 'Utility',
          damageKind: 'explosion',
          holosmithStrikeFactor: strikeFactor
        })
      );
    }

    if (condition) {
      context.queue.enqueue(
        buildResolverCondition({
          at,
          name: `${event.skillName} - Vulnerability`,
          skillName: event.skillName,
          condition: String(condition.condition),
          stacks: Number(condition.stacks),
          duration: Number(condition.duration),
          applicationIndex: wall + 1,
          totalApplications: walls,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId
        })
      );
    }
  }
}

/** Resolves the heat-scaled Quickness packet emitted by Holosmith's Radiant Arc variant. */
function handleRadiantArcQuickness(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  queueBuff(context, event, {
    name: 'Radiant Arc - quickness',
    kind: 'quickness',
    stacks: 1,
    duration: requireBalanceNumber(event.duration, 'Radiant Arc field=duration')
  });
}

/** Materializes every heat-granted Refraction Cutter blade as a strike, bleed, and projectile finisher. */
function handleRefractionCutterExtraBlades(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const extraBlades = Math.max(0, Math.trunc(Number(holosmithEventMetadata(event).extraBlades || 0)));
  const refractionCutterHeatTierProfile = requireBalanceProfileFromContext(context, PROFILE.refractionCutterHeatTier);
  const delay = Math.max(0, balanceProfileNumber(refractionCutterHeatTierProfile, 'initialDelay'));
  const strike = requireEffect(refractionCutterHeatTierProfile, 'strike', 'Refraction Cutter Heat Tier');
  const condition = requireEffect(refractionCutterHeatTierProfile, 'condition', 'Bleeding');
  // Materialize each extra blade independently so its strike can own a matching combo attempt and bleed.
  for (let blade = 0; blade < extraBlades; blade += 1) {
    const at = event.at + delay;
    if (strike) {
      const damage = context.queue.enqueue(
        buildResolverStrike({
          at,
          name: 'Refraction Cutter Blade',
          // Heat-generated blades share the base projectile's separate damage identity.
          damageBreakdownName: 'Refraction Cutter Blade',
          skillName: event.skillName,
          coefficient: effectNumber(refractionCutterHeatTierProfile, strike, 'coefficient'),

          hitIndex: blade + 2,
          totalHits: extraBlades + 1,
          source: 'engineer',
          sourceId: ID.REFRACTION_CUTTER_BLADE,
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
        })
      );
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
    }

    // Pair the blade's bleed with the same delayed impact and application index.
    if (condition) {
      context.queue.enqueue(
        buildResolverCondition({
          at,
          name: `${event.skillName} - Bleeding`,
          skillName: event.skillName,
          condition: String(condition.condition),
          stacks: Number(condition.stacks),
          duration: Number(condition.duration),
          applicationIndex: blade + 2,
          totalApplications: extraBlades + 1,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: 'player',
          skillId: event.skillId
        })
      );
    }
  }
}

/** Routes Holosmith custom resolver events to their heat-aware packet materializers. */
export const holosmithResolverEventHandlers = Object.freeze({
  'engineer.solar-focusing-lens': handleSolarFocusingLens,
  'engineer.prime-light-beam-field': handlePrimeLightBeamField,
  'engineer.laser-disk': handleLaserDisk,
  'engineer.launch-wall': handleLaunchWall,
  'engineer.radiant-arc-quickness': handleRadiantArcQuickness,
  'engineer.refraction-cutter-extra-blades': handleRefractionCutterExtraBlades
});
