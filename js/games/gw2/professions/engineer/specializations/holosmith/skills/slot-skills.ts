/**
 * Owns Holosmith slot, toolbelt, and palette-follow-up skill definitions.
 * Persistent heat and forge state live under `mechanics/photon-forge.ts`.
 */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/cast-effects.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  holosmithHeatSnapshotFromEvent,
  holosmithHeatTier,
  holosmithSkillStrikeFactor,
  snapshotHolosmithHeat
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import type {
  HolosmithSkill,
  HolosmithSkillFragment
} from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type {
  EngineerResolverContext,
  EngineerRuntime,
  EngineerRuntimeState
} from '#gw2/professions/engineer/types.js';

// Seconds from Launch Wall's heat event to its walls' shared impact.
const LAUNCH_WALL_IMPACT_DELAY = 0.48;

/** Supplies Holosmith slot-skill definitions to Holosmith module composition. */
export const HOLOSMITH_SLOT_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = {
  [ID.COOLANT_BLAST]: {
    name: 'Coolant Blast',
    icon: 'https://render.guildwars2.com/file/FC409CF9B0063964C23A62311EF52B71A6F064D9/1770388.png',
    type: 'Heal',
    slot: 'Heal',
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
    name: 'Launch Wall',
    icon: 'https://render.guildwars2.com/file/0B07BD5AD1FA7107A97DB35A22A17E73FB989824/1770413.png',
    type: 'Utility',
    slot: 'Utility',
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
    name: 'Prime Light Beam',
    icon: 'https://render.guildwars2.com/file/80052B4C12919318036326D6D2A579C76867DF1B/1770387.png',
    type: 'Elite',
    slot: 'Elite',
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
        name: 'Prime Light Beam - Packet 1',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      },
      {
        type: 'custom',
        eventType: 'engineer.prime-light-beam-field',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        event: { name: 'Prime Light Beam - field' },
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
    name: 'Laser Disk',
    icon: 'https://render.guildwars2.com/file/A01806176C59A9D0E80A5A7F5BAC2B7C96E51DC6/1770411.png',
    type: 'Utility',
    slot: 'Utility',
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
    name: 'Photon Wall',
    icon: 'https://render.guildwars2.com/file/17FCB62A75625CDE2DC279FB9209D65974C8F435/1770412.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 25,
    castTimeMs: 400,
    effects: [],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.LAUNCH_WALL, durationSec: null } }]
  },
  [ID.BLADE_BURST]: {
    name: 'Blade Burst',
    icon: 'https://render.guildwars2.com/file/1C472B68AAFFA6E50C29524CC7EF5B6AB5532803/1770393.png',
    type: 'Profession',
    slot: 'Action',

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
    name: 'Cauterize',
    icon: 'https://render.guildwars2.com/file/923048741863452B14360357FDD603A9DA04F7B9/1770394.png',
    type: 'Profession',
    slot: 'Profession_1',

    cooldown: 30,
    toolbeltParentId: ID.COOLANT_BLAST,
    mechanicSlot: 1,
    castTimeMs: 0,
    effects: []
  },
  [ID.PARTICLE_ACCELERATOR]: {
    name: 'Particle Accelerator',
    icon: 'https://render.guildwars2.com/file/1C03EBDDD56EC42F4E42DB5BA9E2CB0AFAA1AFE6/1770396.png',
    type: 'Profession',
    slot: 'Action',

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
};

/** Heat selection stays local; the shared emitter expands paired applications with their captured delivery fields. */
function emitHeatApplications(
  context: EngineerResolverContext,
  event: HolosmithResolverEvent,
  skill: Skill,
  effects: readonly SkillEffect[],
  applications: number,
  intervalMs: number,
  atMs: number,
  conditionBaseDurationFactor?: number
): void {
  // A removed or zero-count component must not become the materializer's default single application.
  if (applications === 0) return;

  const strikeFactor = holosmithSkillStrikeFactor(context.helpers, skill.id, holosmithHeatSnapshotFromEvent(event));
  context.effects.emit({
    kind: 'profile',
    profile: skill,
    effects: effects.map((effect): SkillEffect => ({
      ...effect,
      applications,
      intervalMs,
      atMs,
      timingScale: 'fixed'
    })),
    order: 'application',
    at: event.at,
    fullEnd: event.at,
    cause: event,
    attribution: {
      source: 'engineer',
      sourceId: event.skillId ?? event.sourceId,
      actorType: ACTOR.PLAYER,
      skillId: event.skillId,
      skillName: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      ...(packet.type === 'damage' ? { holosmithStrikeFactor: strikeFactor } : {}),
      ...(packet.type === 'condition' && conditionBaseDurationFactor !== undefined
        ? { holosmithConditionBaseDurationFactor: conditionBaseDurationFactor }
        : {})
    })
  });
}

/** The field uses the activation's heat tier even when heat changes before later pulses land. */
function handlePrimeLightBeamField(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const tier = holosmithHeatTier(holosmithHeatSnapshotFromEvent(event), context.helpers);

  if (tier === 'base') return;

  const skill = requireSkill(context.helpers, ID.PRIME_LIGHT_BEAM);
  const strike = requireEffect(skill, 'strike', 'Prime Light Beam Heat Tier');
  const condition = requireEffect(skill, 'condition', CONDITION.BURNING);
  emitHeatApplications(
    context,
    event,
    skill,
    [
      ...(strike ? [{ ...strike, name: 'Field Damage', weapon: 'Unequipped', damageKind: 'explosion' }] : []),
      ...(condition ? [{ ...condition, name: `${event.skillName} - Burning` }] : [])
    ],
    Math.max(0, Math.trunc(skillNumber(skill, 'packetCount'))),
    Math.max(0, skillNumber(skill, 'packetInterval')) * 1000,
    0,
    tier === 'enhanced' ? skillNumber(skill, 'enhancedConditionBaseDurationFactor') : 1
  );
}

/** The disk selects its lifetime once, then emits each strike before its sibling Bleeding application. */
function handleLaserDisk(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const tier = holosmithHeatTier(holosmithHeatSnapshotFromEvent(event), context.helpers);
  const skill = requireSkill(context.helpers, ID.LASER_DISK);
  const payload = requireSkillAction(skill, 'heat-payload');
  const strike = requireEffect(skill, 'strike', 'Laser Disk Heat Tier', payload);
  const condition = requireEffect(skill, 'condition', CONDITION.BLEEDING, payload);
  const intervalMs = Math.max(0, skillNumber(skill, 'packetInterval')) * 1000;
  emitHeatApplications(
    context,
    event,
    skill,
    [
      ...(strike ? [{ ...strike, name: 'Laser Disk', weapon: 'Utility' }] : []),
      ...(condition ? [{ ...condition, name: `${event.skillName} - Bleeding` }] : [])
    ],
    Math.max(0, Math.trunc(skillNumber(skill, tier === 'base' ? 'basePacketCount' : 'highPacketCount'))),
    intervalMs,
    intervalMs
  );
}

/** Simultaneous walls retain full damage per application and interleave Vulnerability between strikes. */
function handleLaunchWall(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const tier = holosmithHeatTier(holosmithHeatSnapshotFromEvent(event), context.helpers);
  const skill = requireSkill(context.helpers, ID.LAUNCH_WALL);
  const payload = requireSkillAction(skill, 'heat-payload');
  const strike = requireEffect(skill, 'strike', 'Launch Wall Heat Tier', payload);
  const condition = requireEffect(skill, 'condition', CONDITION.VULNERABILITY, payload);
  emitHeatApplications(
    context,
    event,
    skill,
    [
      ...(strike ? [{ ...strike, name: 'Launch Wall', weapon: 'Utility', damageKind: 'explosion' }] : []),
      ...(condition ? [{ ...condition, name: `${event.skillName} - Vulnerability` }] : [])
    ],
    Math.max(0, Math.trunc(skillNumber(skill, tier === 'base' ? 'basePacketCount' : 'highPacketCount'))),
    0,
    LAUNCH_WALL_IMPACT_DELAY * 1000
  );
}

/** Slot skills own their captured expansions and direct strikes retain live heat selection. */
export function prepareHolosmithSlotEvent(
  context: EngineerRuntime<HolosmithSkill>,
  event: SimulationEventBase
): SimulationEventBase {
  if (['engineer.laser-disk', 'engineer.launch-wall', 'engineer.prime-light-beam-field'].includes(event.type)) {
    const snapshot = snapshotHolosmithHeat(holosmithState.from(context.profession), context.config);
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
