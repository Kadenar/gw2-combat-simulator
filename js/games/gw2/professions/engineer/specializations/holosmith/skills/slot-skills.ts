import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import type { EngineerResolverContext, EngineerRuntime } from '#gw2/professions/engineer/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  holosmithHeatSnapshotFromEvent,
  holosmithHeatTier,
  holosmithProfileStrikeFactor,
  snapshotHolosmithHeat
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
/**
 * Owns Holosmith slot, toolbelt, and palette-follow-up skill fragments.
 * Persistent heat and forge state live under `mechanics/photon-forge.ts`.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  HolosmithSkill,
  HolosmithSkillFragment
} from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies Holosmith slot-skill fragments to Holosmith module composition. */
export const HOLOSMITH_SLOT_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.COOLANT_BLAST]: {
    castTimeMs: 520,
    cooldown: 20,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.LAUNCH_WALL]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.LAUNCH_WALL } }],
    // Availability requires the parent skill's exposed window.

    castTimeMs: 520,
    cooldown: 0.5,
    flipParentName: 'Photon Wall',
    effects: [
      {
        type: 'custom',
        eventType: 'engineer.launch-wall',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Launch Wall'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.PRIME_LIGHT_BEAM]: {
    castTimeMs: 1160,
    cooldown: 60,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Prime Light Beam — Packet 1',
        actorType: 'player',
        damageKind: 'explosion'
      },
      {
        type: 'custom',
        eventType: 'engineer.prime-light-beam-field',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        event: {
          name: 'Prime Light Beam — field'
        },
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'launch'
      }
    ]
  },
  [ID.LASER_DISK]: {
    castTimeMs: 960,
    interruptCommitMs: 920,
    cooldown: 30,
    effects: [
      {
        type: 'custom',
        eventType: 'engineer.laser-disk',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Laser Disk'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.PHOTON_WALL]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.LAUNCH_WALL, durationSec: null } }],
    castTimeMs: 400,
    cooldown: 25,
    paletteFlipSkillId: ID.LAUNCH_WALL,
    effects: []
  },
  [ID.BLADE_BURST]: {
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Blade Burst',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ],
    toolbeltParentId: ID.LASER_DISK
  },
  [ID.CAUTERIZE]: {
    castTimeMs: 0,
    cooldown: 30,
    effects: [],
    toolbeltParentId: ID.COOLANT_BLAST,
    mechanicSlot: 1
  },
  [ID.PARTICLE_ACCELERATOR]: {
    castTimeMs: 0,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Particle Accelerator',
        weapon: 'Profession mechanic',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ],
    toolbeltParentId: ID.PHOTON_WALL
  }
});

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
      context.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
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
      });
    }

    if (condition) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
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
      });
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
      context.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
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
      });
    }

    if (condition) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
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
      });
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
      context.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
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
      });
    }

    if (condition) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverCondition({
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
      });
    }
  }
}

/** Slot skills own their captured expansions and direct strikes retain live heat selection. */
export function prepareHolosmithSlotEvent(
  context: EngineerRuntime<HolosmithSkill>,
  event: SimulationEventBase
): SimulationEventBase {
  if (['engineer.laser-disk', 'engineer.launch-wall', 'engineer.prime-light-beam-field'].includes(event.type)) {
    const snapshot = snapshotHolosmithHeat(context);
    return {
      ...event,
      holosmithActivationHeat: snapshot.heat,
      holosmithEnhancedCapacitySelected: snapshot.enhancedCapacitySelected
    };
  }

  if (event.type !== 'damage' || event.actorType !== 'player') return event;
  const id = event.skillId ?? event.sourceId;
  const profile =
    id === ID.BLADE_BURST
      ? PROFILE.bladeBurstHeatTier
      : id === ID.PARTICLE_ACCELERATOR
        ? PROFILE.particleAcceleratorHeatTier
        : undefined;
  return profile == null ? event : { ...event, holosmithStrikeProfileId: profile };
}

export const holosmithSlotEventHandlers = Object.freeze({
  'engineer.prime-light-beam-field': handlePrimeLightBeamField,
  'engineer.laser-disk': handleLaserDisk,
  'engineer.launch-wall': handleLaunchWall
});
