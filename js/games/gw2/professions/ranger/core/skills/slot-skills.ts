import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  activeChargeGrants,
  appendChargeGrant,
  consumeChargeBatch,
  grantCharges
} from '#gw2/platform/combat/resources/charges.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { grantSkillCharges } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerResolverContext,
  RangerRuntime,
  RangerRuntimeState,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

/** Canonical Core ranger skill fragments grouped by their GW2 owner. */

/** The spirit supplies Power after player bonuses; Precision and Ferocity remain the Ranger's attributes. */
export function modifyStormSpiritAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats
): Gw2ResolvedStats {
  return context.event?.type === 'damage' && context.event.skillId === ID.CALL_LIGHTNING
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
    // A committed summon invokes Call Lightning; the parent owns only its summon reward and boon shakes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.storm-spirit' } }],
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      },
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
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
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
    // Use the dedicated spirit icon because the API supplies a generic missing-icon asset.
    icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Call_Lightning_(Ranger).png',
    // The spirit owns the slam formula; the Ranger supplies critical stats and outgoing modifiers.
    effects: [
      { type: 'control', controlKind: 'daze' },
      {
        type: 'strike',
        coefficient: 2,
        weaponStrengthProfileId: 'summon.storm-spirit',
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
  const companionId = rangerPetCompanionId(runtime);
  const petActive = runtime.profession.core.petActive;
  const copies = (cast.skill.effects ?? [])
    .filter((effect) => effect.type === 'boon')
    .map((effect) => {
      const kind = String(effect.boon);
      const player = runtime.combat.boonSnapshot(kind, runtime.time, { actor: 'player' }).stacks;
      return {
        kind,
        duration: Number(effect.duration),
        player,
        pet: petActive
          ? runtime.combat.boonSnapshot(kind, runtime.time, { actor: 'companion', companionId }).stacks
          : player
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

/** Invoke the selected child skill once per slam; the trait repeat halves only its strike damage. */
export function emitStormSpiritSlam(
  runtime: RangerRuntime,
  cast: RuntimeCast<RangerSkill>,
  at: number,
  repeat = false
): void {
  const lightning = runtime.helpers.skillsById.get(ID.CALL_LIGHTNING);
  if (!lightning) throw new Error('Storm Spirit requires the Call Lightning skill.');
  runtime.effects.emit({
    kind: 'profile',
    profile: lightning,
    at,
    attribution: {
      source: 'ranger',
      sourceId: lightning.id,
      actorType: 'player',
      skillId: lightning.id,
      skillName: lightning.name,
      // Keep the summon activation so isolated previews and causal queries include its child damage.
      activationId: cast.id,
      triggeredBy: cast.skill.name,
      metadata: { packetKind: 'ranger.spirit-slam' }
    },
    transform: (event) => ({
      ...event,
      icon: lightning.icon,
      ...(repeat && event.type === 'damage' ? { coefficient: Number(event.coefficient) / 2 } : {})
    })
  });
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
          // Pet commands bind the active companion incarnation; merged commands belong to the player.
          audience:
            kind === 'sic-em-pet'
              ? {
                  recipients: 'summons',
                  affectsSelf: false,
                  maximumRecipients: 1,
                  eligibleCompanionIds: [rangerPetCompanionId(runtime)]
                }
              : { recipients: 'self' },
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

/** The owning skill supplies charge limits, lifetime, and the triggered condition packet. */
export const sharpeningStoneProfile = variant(
  PROFILE.sharpeningStone,
  ID.SHARPENING_STONE,
  'Sharpening Stone - Triggered Bleeding',
  {
    playerStacks: 10,
    durationMultiplier: 30,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 8 }]
  }
);

export function handleRangerSharpeningStone(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Recasts add charges without renewing the lifetime of the remaining stones.
  state.sharpeningStoneGrants = appendChargeGrant(
    state.sharpeningStoneGrants,
    grantCharges(Math.trunc(Math.max(0, Number(event.charges || 0))), event.at + (event.duration || 0)),
    event.at,
    'earliest-expiry'
  );
}

export function triggerSharpeningStone(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const eligible = isPlayerStrike(event) && Number(event.coefficient) > 0;
  const profile = eligible ? requireBalanceProfileFromContext(context, PROFILE.sharpeningStone) : undefined;
  const bleeding = profile && requireEffect(profile, 'condition', 'Bleeding');
  // Grants sort by expiry: spend the earliest deadline, and still prune on ineligible hits. Grants exist only to
  // deliver bleeding, so a removed packet only prunes them.
  state.sharpeningStoneGrants = activeChargeGrants(state.sharpeningStoneGrants, event.at);
  if (!profile || !bleeding || !consumeChargeBatch(state.sharpeningStoneGrants, event.at)) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      source: 'ranger',
      sourceId: ID.SHARPENING_STONE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.SHARPENING_STONE,
      skillName: 'Sharpening Stone',
      name: 'Sharpening Stone - Bleeding',
      condition: String(bleeding.condition),
      duration: effectNumber(profile, bleeding, 'duration'),
      stacks: effectNumber(profile, bleeding, 'stacks'),
      triggeredBy: event.skillName
    })
  });
}

/** Queue grants at the declared activation boundary so same-time hits retain their established order. */
export const sharpeningStoneLifecycle = {
  sideEffectHandlers: {
    'ranger.sharpening-stone'(runtime, context) {
      if (context.kind === 'cast')
        grantSkillCharges(runtime, context.cast, 'ranger.sharpening-stone', PROFILE.sharpeningStone);
    }
  },
  eventHandlers: { 'ranger.sharpening-stone': handleRangerSharpeningStone }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
