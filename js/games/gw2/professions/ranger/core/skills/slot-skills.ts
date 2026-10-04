import type { RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** The spirit supplies Power after player bonuses; Precision and Ferocity remain the Ranger's attributes. */
export function modifyStormSpiritAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats
): Gw2ResolvedStats {
  return context.event?.type === 'damage' && context.event.skillId === ID.STORM_SPIRIT
    ? { ...attributes, power: 1580 }
    : attributes;
}

/** All spirit slams and their first shakes share this delay after the summoning cast completes. */
export const RANGER_SPIRIT_SLAM_DELAY_MS = 920;

/** Identify slam packets so Nature's Vengeance repeats neither summon rewards nor boon shakes. */
function spiritSlam(effects: readonly SkillEffect[]): SkillEffect[] {
  return impactEffects(
    { atMs: RANGER_SPIRIT_SLAM_DELAY_MS, timingAnchor: 'castEnd', timingScale: 'fixed' },
    effects.map((effect) => ({ ...effect, metadata: { ...effect.metadata, packetKind: 'ranger.spirit-slam' } }))
  );
}

/** Every spirit starts four one-second boon shakes alongside its initial slam. */
function spiritShakes(boon: string, duration: number, stacks = 1): SkillEffect {
  return {
    type: 'boon',
    boon,
    duration,
    stacks,
    applications: 4,
    atMs: RANGER_SPIRIT_SLAM_DELAY_MS,
    intervalMs: 1000,
    timingAnchor: 'castEnd',
    timingScale: 'fixed',
    audience: { recipients: 'party', maximumRecipients: 5 }
  };
}

export const RANGER_CORE_SLOT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPIKE_TRAP]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6
      }
    ],
    castTimeMs: 333
  },
  [ID.TROLL_UNGUENT]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.HEALING_SPRING]: {
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 6
      }
    ],
    castTimeMs: 333
  },
  [ID.SIGNET_OF_THE_WILD]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [520, 1520, 2520, 3520].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      ...[520, 1520, 2520, 3520].map((atMs) => ({
        type: 'condition' as const,
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        atMs
      }))
    ]),
    castTimeMs: 520
  },
  [ID.FROST_TRAP]: {
    interruptCommitMs: 440,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'condition',
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          condition: 'Chilled',
          stacks: 1,
          duration: 2
        }))
      },
      {
        type: 'strike',
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          coefficient: 1
        }))
      }
    ]),
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Ice',
        duration: 5,
        startMs: 880,
        startAnchor: 'castStart'
      }
    ]
  },
  [ID.STORM_SPIRIT]: {
    // The measured Quickness timeline lands the slam and first Fury pulse together at 1.28 seconds.
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      },
      ...spiritSlam([
        { type: 'control', controlKind: 'daze' },
        // Storm Spirit supplies power and weapon strength; the Ranger supplies critical stats and strike modifiers.
        { type: 'strike', coefficient: 2, weaponStrengthProfileId: 'summon.storm-spirit' }
      ]),
      spiritShakes('fury', 2)
    ],
    castTimeMs: 360
  },
  [ID.STONE_SPIRIT]: {
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1
      },
      ...spiritSlam([
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 6,
          comboFinishers: [{ ownerId: 'ranger', finisherType: 'Blast' }]
        },
        { type: 'condition', condition: 'Weakness', stacks: 1, duration: 6 }
      ]),
      spiritShakes('protection', 2)
    ],
    castTimeMs: 167
  },
  [ID.VIPERS_NEST]: {
    interruptCommitMs: 440,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [1400, 2400, 3400].map((atMs) => ({
          atMs,
          coefficient: 0.3
        }))
      },
      {
        type: 'condition',
        ticks: [1400, 2400, 3400].map((atMs) => ({
          atMs,
          condition: 'Poisoned',
          stacks: 2,
          duration: 8
        }))
      }
    ]),
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 600,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Poison',
        duration: 2,
        startMs: 1400,
        startAnchor: 'castStart'
      }
    ]
  },
  [ID.FROST_SPIRIT]: {
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 4,
        stacks: 1
      },
      // Cleansing is outside combat scope, but Cold Snap's blast still resolves combo fields.
      ...spiritSlam([
        {
          type: 'custom',
          eventType: 'marker',
          event: { name: 'Cold Snap' },
          comboFinishers: [{ ownerId: 'ranger', finisherType: 'Blast' }]
        }
      ]),
      spiritShakes('resolution', 2)
    ],
    castTimeMs: 167
  },
  [ID.SUN_SPIRIT]: {
    // A committed summon schedules Solar Flare alongside its first shake.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.sun-spirit' } }],
    effects: [
      spiritShakes('might', 15, 2),
      {
        type: 'blind',
        duration: 5
      }
    ],

    cooldown: 20,
    // Use the measured Quickness animation so later casts begin at the logged time.
    castTimeMs: 360
  },
  [ID.FLAME_TRAP]: {
    interruptCommitMs: 500,
    // Arm after placement, then preserve the trap's pulses and field independently of later casts.
    // ponytail: nominal half-second pulse spacing; calibrate these offsets against a live combat log if needed.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [520, 520, 1000, 1520, 2000, 2520].map((atMs) => ({ atMs, coefficient: 0.3 })),
        name: 'Flame Trap - Damage per Pulse'
      },
      {
        type: 'condition',
        ticks: [520, 520, 1000, 1520, 2000, 2520].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2.5
        }))
      }
    ]),
    comboFields: [{ ownerId: 'ranger', fieldType: 'Fire', duration: 3, startMs: 520, startAnchor: 'castEnd' }],
    castTimeMs: 333
  },
  [ID.MUDDY_TERRAIN]: {
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1
      },
      // Immobilize applies once when the area is created, independently of its pulses (wiki: Muddy_Terrain).
      { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 3 }
    ],
    castTimeMs: 500
  },
  [ID.STRENGTH_OF_THE_PACK]: {
    categories: ['Command'],
    effects: [
      {
        type: 'buff',
        kind: 'strength-of-the-pack',
        duration: 10,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 12,
        stacks: 1,
        audience: { recipients: 'summons' as const, maximumRecipients: 2 }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 8,
        stacks: 10,
        audience: { recipients: 'summons' as const, maximumRecipients: 2 }
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 12,
        stacks: 1,
        audience: { recipients: 'summons' as const, maximumRecipients: 2 }
      }
    ],
    // The command completes on the 840 ms action tick before its buffs and command traits apply.
    castTimeMs: 840
  },
  [ID.SHARPENING_STONE]: {
    // Activate the intrinsic reward at its declared boundary, before common trait observers.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.sharpening-stone' } }
    ],
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: true
  },
  [ID.SPIRIT_OF_NATURE]: {
    // Revival has no combat payload while all players remain alive at full health.
    effects: [
      ...spiritSlam([{ type: 'custom', eventType: 'marker', event: { name: "Nature's Renewal" } }]),
      spiritShakes('regeneration', 3)
    ],
    castTimeMs: 1000
  },
  [ID.ENTANGLE]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          coefficient: 0.16
        }))
      },
      {
        type: 'condition',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 8
        }))
      },
      {
        type: 'condition',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          condition: 'Immobilized',
          stacks: 1,
          duration: 2
        }))
      }
    ]),
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 680
  },
  [ID.SOLAR_FLARE]: {
    // The API exposes a generic missing-icon asset, so pin the wiki's dedicated icon for result rows.
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Solar_Flare.png',
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 6
      }
    ],
    castTimeMs: 500
  },
  [ID.CALL_LIGHTNING]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.QUAKE]: {
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6
      }
    ],
    castTimeMs: 500
  },
  [ID.COLD_SNAP]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.NATURES_RENEWAL]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.PROTECT_ME]: {
    categories: ['Command'],
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.GUARD]: {
    categories: ['Command'],
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.SIC_EM]: {
    // Instant activation selects the current pet or merged recipient before subsequent impacts.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.sic-em' } }],
    categories: ['Command'],
    castTimeMs: 0,
    effects: []
  },
  [ID.WATER_SPIRIT]: {
    // Healing has no combat payload under the fixed-full-health simulation assumption.
    effects: [
      ...spiritSlam([{ type: 'custom', eventType: 'marker', event: { name: 'Aqua Surge' } }]),
      spiritShakes('vigor', 2)
    ],
    castTimeMs: 500
  },
  [ID.AQUA_SURGE]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.WE_HEAL_AS_ONE]: {
    // Activate the intrinsic reward at its declared boundary, before common trait observers.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.copy-healing-boons' } }],
    categories: ['Command'],
    // These non-emitting templates provide the duration menu for the live two-way copy.
    effects: [
      { type: 'boon', when: () => false, boon: 'aegis', duration: 5 },
      { type: 'boon', when: () => false, boon: 'alacrity', duration: 3 },
      { type: 'boon', when: () => false, boon: 'fury', duration: 3 },
      { type: 'boon', when: () => false, boon: 'might', duration: 10 },
      { type: 'boon', when: () => false, boon: 'protection', duration: 2 },
      { type: 'boon', when: () => false, boon: 'quickness', duration: 2 },
      { type: 'boon', when: () => false, boon: 'regeneration', duration: 5 },
      { type: 'boon', when: () => false, boon: 'resistance', duration: 2 },
      { type: 'boon', when: () => false, boon: 'resolution', duration: 5 },
      { type: 'boon', when: () => false, boon: 'stability', duration: 3 },
      { type: 'boon', when: () => false, boon: 'swiftness', duration: 3 },
      { type: 'boon', when: () => false, boon: 'vigor', duration: 3 }
    ],
    castTimeMs: 920
  }
});

/** Copy both actors from one executed-time snapshot so the first copy never feeds the second. */
export function copyHealingBoons(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const timeline = createGw2TimelineIndex({ events: runtime.facts.read() });
  const companionId = rangerPetCompanionId(runtime);
  const petActive = runtime.profession.core.petActive;
  const copies = (cast.skill.effects ?? [])
    .filter((effect) => effect.type === 'boon')
    .map((effect) => {
      const kind = String(effect.boon);
      const maximum = kind === 'might' || kind === 'stability' ? 25 : 1;
      const configured = runtime.config.boons?.[kind];
      const player = Math.min(
        maximum,
        Number(configured || 0) +
          buffApplicationStacks(runtime.combat.boonApplications(kind), kind, runtime.time, maximum, {
            ordered: true
          })
      );
      return {
        kind,
        duration: Number(effect.duration),
        player,
        pet: petActive ? timeline.buffStacksAt(kind, runtime.time, 0, maximum, 'summon', companionId) : player
      };
    });
  for (const { kind, duration, player, pet } of copies) {
    const event = buildRangerPacket(
      { at: runtime.time, skillId: cast.skill.id, skillName: cast.skill.name, activationId: cast.id, kind, duration },
      'buff'
    );
    if (pet > 0)
      runtime.effects.emit({ kind: 'packet', event: { ...event, stacks: pet, audience: { recipients: 'self' } } });
    if (petActive && player > 0)
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...event,
          stacks: player,
          audience: {
            recipients: 'summons',
            affectsSelf: false,
            maximumRecipients: 1,
            eligibleCompanionIds: [companionId]
          }
        }
      });
  }
}

/** Attribute Solar Flare's separately patchable burning to the initial or repeated slam time. */
export function emitSunSpiritBurning(runtime: RangerRuntime, skill: Skill, at: number): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sunSpirit);
  const burning = requireEffect(profile, 'condition', 'Burning');
  if (burning) {
    runtime.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          skillId: ID.SOLAR_FLARE,
          skillName: 'Solar Flare',
          name: 'Solar Flare - Burning',
          condition: String(burning.condition),
          stacks: effectNumber(profile, burning, 'stacks'),
          duration: effectNumber(profile, burning, 'duration'),
          triggeredBy: skill.name
        },
        'condition'
      )
    });
  }
}

/** Select the live recipient at activation; Core always registers this action, including unmerged builds. */
export function activateSicEm(runtime: RangerRuntime, skill: Skill): void {
  const specialization = runtime.profession.specialization;
  const merged = specialization.kind === 'Soulbeast' && specialization.state.beastmodeActive;
  for (const kind of [...(runtime.profession.core.petActive ? ['sic-em-pet'] : []), ...(merged ? ['sic-em'] : [])])
    runtime.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at: runtime.time,
          skillId: skill.id,
          skillName: skill.name,
          kind,
          priority: -20,
          stacks: 1,
          duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.sicEm), 'durationMultiplier')
        },
        'buff'
      )
    });
}

/** Hold deployed trap packets until explicit engagement, preserving their relative pulses and field lifetime. */
export function prepareFrostTrapEvent(runtime: RangerRuntime, event: SimulationEventBase): SimulationEventBase | null {
  if (
    runtime.hasExplicitCombatStart &&
    runtime.combatStartPending &&
    event.skillId === ID.FROST_TRAP &&
    !event.cancelled &&
    ['damage', 'condition', 'combo_field'].includes(event.type)
  ) {
    runtime.profession.core.pendingFrostTrapEvents.push(event);
    return null;
  }

  return event;
}

/** Drain once; a repeated engagement notification cannot replay or renew the trap. */
export function releaseFrostTrap(runtime: RangerRuntime): void {
  const pending = runtime.profession.core.pendingFrostTrapEvents;
  runtime.profession.core.pendingFrostTrapEvents = [];
  const delay = Math.max(0, runtime.time - Math.min(...pending.map((event) => event.at)));
  for (const event of pending)
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...event,
        at: event.at + delay,
        ...(event.type === 'combo_field' ? { expiresAt: Number(event.expiresAt) + delay } : {})
      }
    });
}

/** Selected Signet of the Wild grants ferocity only while ready; callers supply their own observation clock. */
export function signetOfTheWildBonus(context: unknown, selected: boolean, ready = true): number {
  return selected && ready
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.signetOfTheWild), 'attributeBonus')
    : 0;
}
