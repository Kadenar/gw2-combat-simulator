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

/** Supplies Holosmith slot-skill fragments to Holosmith module composition. */
export const HOLOSMITH_SLOT_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.COOLANT_BLAST]: {
    castTimeMs: 520,
    cooldown: 20,
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
    initialDelay: 0.48,
    enhancedStrikeFactor: 1.35,

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
    ],
    // Availability requires the parent skill's exposed window.

    castTimeMs: 520,
    cooldown: 0.5,
    requiresArmedFlip: true,
    effects: []
  },
  [ID.PRIME_LIGHT_BEAM]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1,
    packetCount: 10,
    packetInterval: 1,
    enhancedStrikeFactor: 1.2,
    enhancedConditionBaseDurationFactor: 1.5,

    castTimeMs: 1160,
    cooldown: 60,
    // The field resolver consumes these named templates; acceptance emits only the initial beam, marker, and control.
    effectVariants: [
      {
        when: () => true,
        transform: (_runtime, _cast, effects) => effects.filter((effect) => effect.metadata?.trigger !== 'heat-field')
      }
    ],
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
    ]
  },
  [ID.LASER_DISK]: {
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
    ],
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1,
    basePacketCount: 12,
    highPacketCount: 18,
    packetInterval: 0.52,
    enhancedStrikeFactor: 1.35,

    castTimeMs: 960,
    interruptCommitMs: 920,
    cooldown: 30,
    effects: []
  },
  [ID.PHOTON_WALL]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.LAUNCH_WALL, durationSec: null } }],
    castTimeMs: 400,
    cooldown: 25,
    effects: []
  },
  [ID.BLADE_BURST]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1.25,
    enhancedStrikeFactor: 1.35,

    castTimeMs: 0,
    cooldown: 20,
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
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    highStrikeFactor: 1.1,
    enhancedStrikeFactor: 1.35,

    castTimeMs: 0,
    cooldown: 8,
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
  const at = event.at + Math.max(0, skillNumber(skill, 'initialDelay'));
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
