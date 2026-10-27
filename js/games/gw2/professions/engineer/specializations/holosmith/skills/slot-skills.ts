import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/cast-effects.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { ACTOR, CONTROL, COMBO_FINISHER, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import {
  requireSkillFromContext,
  requireEffect,
  skillNumber,
  effectNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { EngineerResolverContext, EngineerRuntime } from '#gw2/professions/engineer/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  holosmithHeatSnapshotFromEvent,
  holosmithHeatTier,
  holosmithSkillStrikeFactor,
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

// Seconds from Launch Wall's heat event to its walls' shared impact.
const LAUNCH_WALL_IMPACT_DELAY = 0.48;

/** Supplies Holosmith slot-skill fragments to Holosmith module composition. */
export const HOLOSMITH_SLOT_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.COOLANT_BLAST]: {
    cooldown: 20,
    castTimeMs: 520,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.LAUNCH_WALL]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1,
    basePacketCount: 1,
    highPacketCount: 3,
    enhancedStrikeFactor: 1.35,
    cooldown: 0.5,
    requiresArmedFlip: true,
    // Availability requires the parent skill's exposed window.

    castTimeMs: 520,
    effects: [],

    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'engineer.launch-wall',
          id: 'heat-payload',
          effects: [
            {
              name: 'Launch Wall Heat Tier',
              type: 'strike',
              coefficient: 1.5,
              hits: 1
            },
            {
              name: 'Vulnerability',
              type: 'condition',
              condition: CONDITION.VULNERABILITY,
              stacks: 3,
              duration: 5
            }
          ]
        }
      },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.LAUNCH_WALL } }
    ]
  },
  [ID.PRIME_LIGHT_BEAM]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1,
    packetCount: 10,
    packetInterval: 1,
    enhancedStrikeFactor: 1.2,
    enhancedConditionBaseDurationFactor: 1.5,
    cooldown: 60,

    castTimeMs: 1160,
    effects: [
      {
        name: 'Prime Light Beam Heat Tier',
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        metadata: { trigger: 'heat-field' }
      },
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        metadata: { trigger: 'heat-field' }
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Prime Light Beam — Packet 1',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'custom',
        eventType: 'engineer.prime-light-beam-field',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        event: { name: 'Prime Light Beam \u2014 field' },
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.LAUNCH
      }
    ],
    // The field resolver consumes these named templates; acceptance emits only the initial beam, marker, and control.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => effect.metadata?.trigger !== 'heat-field')
      }
    ]
  },
  [ID.LASER_DISK]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1,
    basePacketCount: 12,
    highPacketCount: 18,
    packetInterval: 0.52,
    enhancedStrikeFactor: 1.35,
    cooldown: 30,

    castTimeMs: 960,
    interruptCommitMs: 920,
    effects: [],
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'engineer.laser-disk',
          id: 'heat-payload',
          effects: [
            {
              name: 'Laser Disk Heat Tier',
              type: 'strike',
              coefficient: 0.5,
              hits: 1
            },
            {
              name: 'Bleeding',
              type: 'condition',
              condition: CONDITION.BLEEDING,
              stacks: 1,
              duration: 2
            }
          ]
        }
      }
    ]
  },
  [ID.PHOTON_WALL]: {
    cooldown: 25,
    castTimeMs: 400,
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.LAUNCH_WALL, durationSec: null } }]
  },
  [ID.BLADE_BURST]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1.25,
    enhancedStrikeFactor: 1.35,
    cooldown: 20,
    toolbeltParentId: ID.LASER_DISK,

    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Blade Burst',
        weapon: 'Profession mechanic',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.CAUTERIZE]: {
    cooldown: 30,
    toolbeltParentId: ID.COOLANT_BLAST,
    mechanicSlot: 1,
    castTimeMs: 0,
    effects: []
  },
  [ID.PARTICLE_ACCELERATOR]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1.1,
    enhancedStrikeFactor: 1.35,
    cooldown: 8,
    toolbeltParentId: ID.PHOTON_WALL,

    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Particle Accelerator',
        weapon: 'Profession mechanic',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ],
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      }
    ]
  }
});

/**
 * Materializes Prime Light Beam's ten one-second field pulses above 50 heat,
 * with ECSU enhancement above 100 heat taken from the activation snapshot.
 */
function handlePrimeLightBeamField(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  // Derive all packet tuning from the captured activation tier before expanding the delayed field.
  const snapshot = holosmithHeatSnapshotFromEvent(event);
  const tier = holosmithHeatTier(snapshot, context);

  if (tier === 'base') return;

  const enhancedCapacityTier = tier === 'enhanced';
  const skill = requireSkillFromContext(context, ID.PRIME_LIGHT_BEAM);
  const packets = Math.max(0, Math.trunc(skillNumber(skill, 'packetCount')));
  const interval = Math.max(0, skillNumber(skill, 'packetInterval'));
  const strikeFactor = holosmithSkillStrikeFactor(context, ID.PRIME_LIGHT_BEAM, snapshot);
  const strike = requireEffect(skill, 'strike', 'Prime Light Beam Heat Tier');
  const condition = requireEffect(skill, 'condition', CONDITION.BURNING);
  const conditionBaseDurationFactor = enhancedCapacityTier
    ? skillNumber(skill, 'enhancedConditionBaseDurationFactor')
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
          coefficient: effectNumber(skill, strike, 'coefficient'),

          hitIndex: pulse + 1,
          totalHits: packets,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: ACTOR.PLAYER,
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
          actorType: ACTOR.PLAYER,
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
  const tier = holosmithHeatTier(snapshot, context);
  const skill = requireSkillFromContext(context, ID.LASER_DISK);
  const pulses = Math.max(0, Math.trunc(skillNumber(skill, tier === 'base' ? 'basePacketCount' : 'highPacketCount')));
  const interval = Math.max(0, skillNumber(skill, 'packetInterval'));
  const strikeFactor = holosmithSkillStrikeFactor(context, ID.LASER_DISK, snapshot);
  const strike = requireEffect(skill, 'strike', 'Laser Disk Heat Tier', requireSkillAction(skill, 'heat-payload'));
  const condition = requireEffect(skill, 'condition', CONDITION.BLEEDING, requireSkillAction(skill, 'heat-payload'));
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
          coefficient: effectNumber(skill, strike, 'coefficient'),

          hitIndex: pulse + 1,
          totalHits: pulses,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: ACTOR.PLAYER,
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
          actorType: ACTOR.PLAYER,
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
  const tier = holosmithHeatTier(snapshot, context);
  const skill = requireSkillFromContext(context, ID.LAUNCH_WALL);
  const walls = Math.max(0, Math.trunc(skillNumber(skill, tier === 'base' ? 'basePacketCount' : 'highPacketCount')));
  const at = event.at + LAUNCH_WALL_IMPACT_DELAY;
  const strikeFactor = holosmithSkillStrikeFactor(context, ID.LAUNCH_WALL, snapshot);
  const strike = requireEffect(skill, 'strike', 'Launch Wall Heat Tier', requireSkillAction(skill, 'heat-payload'));
  const condition = requireEffect(
    skill,
    'condition',
    CONDITION.VULNERABILITY,
    requireSkillAction(skill, 'heat-payload')
  );
  // Every wall lands together and owns one explosion plus one vulnerability application.
  for (let wall = 0; wall < walls; wall += 1) {
    if (strike) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({
          at,
          name: 'Launch Wall',
          skillName: event.skillName,
          coefficient: effectNumber(skill, strike, 'coefficient'),

          hitIndex: wall + 1,
          totalHits: walls,
          source: 'engineer',
          sourceId: event.skillId ?? event.sourceId,
          actorType: ACTOR.PLAYER,
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
          actorType: ACTOR.PLAYER,
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

  if (event.type !== 'damage' || event.actorType !== ACTOR.PLAYER) return event;

  const id = event.skillId ?? event.sourceId;
  const skill =
    id === ID.BLADE_BURST ? ID.BLADE_BURST : id === ID.PARTICLE_ACCELERATOR ? ID.PARTICLE_ACCELERATOR : undefined;
  return skill == null ? event : { ...event, holosmithStrikeSkillId: skill };
}

export const holosmithSlotEventHandlers = Object.freeze({
  'engineer.prime-light-beam-field': handlePrimeLightBeamField,
  'engineer.laser-disk': handleLaserDisk,
  'engineer.launch-wall': handleLaunchWall
});

/** Launch the skill's deferred component; its resolver reads the selected action payload. */
export const holosmithSlotSideEffectHandlers: RuntimeHooks<EngineerRuntimeState, HolosmithSkill>['sideEffectHandlers'] =
  {
    'engineer.laser-disk'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Heat components require a cast.');

      const { cast } = context;

      if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;

      for (const packet of buildEngineerPackets(
        'engineer.laser-disk',
        { at: runtime.time, activationId: context.cast.id, offTarget: context.cast.command.offTarget },
        context.skill
      ))
        runtime.effects.emit({ kind: 'packet', event: packet });
    },
    'engineer.launch-wall'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Heat components require a cast.');

      const { cast } = context;

      if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;

      for (const packet of buildEngineerPackets(
        'engineer.launch-wall',
        { at: runtime.time, activationId: context.cast.id, offTarget: context.cast.command.offTarget },
        context.skill
      ))
        runtime.effects.emit({ kind: 'packet', event: packet });
    }
  };
