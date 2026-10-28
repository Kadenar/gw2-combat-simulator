// Verified skill icons use ArenaNet render URLs directly so they share the simulator's CDN fallback handling.
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import {
  activeChargeGrants,
  appendChargeGrant,
  consumeChargeBatch,
  grantCharges
} from '#gw2/platform/combat/resources/charges.js';
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildRangerPacket, emitRangerAction, emitRangerProfile } from '#gw2/professions/ranger/core/events.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { deliverChargedHit, grantSkillCharges } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';
import { activeBuff, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerResolverContext,
  RangerRuntime,
  RangerRuntimeState,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

/** Canonical Core ranger skill fragments grouped by their GW2 owner. */

/** All spirit slams and their first shakes share this delay after the summoning cast completes. */
const RANGER_SPIRIT_SLAM_DELAY_MS = 920;

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
    audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
  };
}

export const RANGER_CORE_SLOT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPIKE_TRAP]: {
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 6
      }
    ]
  },
  [ID.TROLL_UNGUENT]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.HEALING_SPRING]: {
    castTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 6
      }
    ]
  },
  [ID.SIGNET_OF_THE_WILD]: {
    // Player and pet passive readers share the selected signet attribute grant.
    attributeBonuses: { ferocity: 180 },
    castTimeMs: 520,
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
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1,
        atMs
      }))
    ])
  },
  [ID.FROST_TRAP]: {
    castTimeMs: 520,
    interruptCommitMs: 440,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.ICE,
        duration: 5,
        startMs: 880,
        startAnchor: 'castStart'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'condition',
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          condition: CONDITION.CHILLED,
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
    ])
  },
  [ID.STORM_SPIRIT]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 10
      },
      spiritShakes(boonKey(BOON.FURY), 2)
    ],
    // A committed summon invokes Call Lightning; the parent owns only its summon reward and boon shakes.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.storm-spirit' } }]
  },
  [ID.STONE_SPIRIT]: {
    castTimeMs: 167,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.AEGIS,
        duration: 5,
        stacks: 1
      },
      ...spiritSlam([
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 6,
          comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.BLAST }]
        },
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 6 }
      ]),
      spiritShakes(boonKey(BOON.PROTECTION), 2)
    ]
  },
  [ID.VIPERS_NEST]: {
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 600,
    interruptCommitMs: 440,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.POISON,
        duration: 2,
        startMs: 1400,
        startAnchor: 'castStart'
      }
    ],
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
          condition: CONDITION.POISONED,
          stacks: 2,
          duration: 8
        }))
      }
    ])
  },
  [ID.FROST_SPIRIT]: {
    castTimeMs: 167,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESISTANCE,
        duration: 4,
        stacks: 1
      },
      // Cleansing is outside combat scope, but Cold Snap's blast still resolves combo fields.
      ...spiritSlam([
        {
          type: 'custom',
          eventType: 'marker',
          event: { name: 'Cold Snap' },
          comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.BLAST }]
        }
      ]),
      spiritShakes(boonKey(BOON.RESOLUTION), 2)
    ]
  },
  [ID.SUN_SPIRIT]: {
    cooldown: 20,
    // Use the measured Quickness animation so later casts begin at the logged time.
    castTimeMs: 360,
    effects: [
      spiritShakes(boonKey(BOON.MIGHT), 15, 2),
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5
      }
    ],
    // A committed summon schedules Solar Flare alongside its first shake.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.sun-spirit' } }]
  },
  [ID.FLAME_TRAP]: {
    castTimeMs: 333,
    interruptCommitMs: 500,
    comboFields: [
      { ownerId: 'ranger', fieldType: COMBO_FIELD.FIRE, duration: 3, startMs: 520, startAnchor: 'castEnd' }
    ],
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
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2.5
        }))
      }
    ])
  },
  [ID.MUDDY_TERRAIN]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1
      },
      // Immobilize applies once when the area is created, independently of its pulses (wiki: Muddy_Terrain).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }
    ]
  },
  [ID.STRENGTH_OF_THE_PACK]: {
    categories: ['Command'],
    // The command completes on the 840 ms action tick before its buffs and command traits apply.
    castTimeMs: 840,
    // Opening the command window owns the Might emitted by later qualifying strikes.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ranger.strength-of-the-pack',
          id: 'triggered-might',
          effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 1 }]
        }
      }
    ],
    duration: 10,
    effects: [
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 12,
        stacks: 1,
        audience: { recipients: RECIPIENT.SUMMONS, maximumRecipients: 2 }
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 8,
        stacks: 10,
        audience: { recipients: RECIPIENT.SUMMONS, maximumRecipients: 2 }
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 12,
        stacks: 1,
        audience: { recipients: RECIPIENT.SUMMONS, maximumRecipients: 2 }
      }
    ]
  },
  [ID.SHARPENING_STONE]: {
    // Unspent charges and their delivered conditions have independent lifetimes.
    charges: 10,
    duration: 30,
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [],
    // Activate the intrinsic reward at its declared boundary, before common trait observers.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'ranger.sharpening-stone',
          id: 'sharpening-stone',
          effects: [
            { name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 8 }
          ]
        }
      }
    ]
  },
  [ID.SPIRIT_OF_NATURE]: {
    castTimeMs: 1000,
    // Revival has no combat payload while all players remain alive at full health.
    effects: [
      ...spiritSlam([{ type: 'custom', eventType: 'marker', event: { name: "Nature's Renewal" } }]),
      spiritShakes(boonKey(BOON.REGENERATION), 3)
    ]
  },
  [ID.ENTANGLE]: {
    // Match the measured Quickness animation from the benchmark EVTC.
    castTimeMs: 680,
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
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 8
        }))
      },
      {
        type: 'condition',
        ticks: [1560, 3080, 4600, 6120, 7640].map((atMs) => ({
          atMs,
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.SOLAR_FLARE]: {
    // The API exposes a generic missing-icon asset, so pin the wiki's dedicated icon for result rows.
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    castTimeMs: 500,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 6
      }
    ]
  },
  [ID.CALL_LIGHTNING]: {
    // Use the dedicated spirit icon because the API supplies a generic missing-icon asset.
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    castTimeMs: 333,
    // The spirit owns the slam formula; the Ranger supplies critical stats and outgoing modifiers.
    effects: [
      { type: 'control', controlKind: CONTROL.DAZE },
      {
        type: 'strike',
        coefficient: 2,
        weaponStrengthProfileId: 'summon.storm-spirit',
        hits: 1
      }
    ]
  },
  [ID.QUAKE]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.COLD_SNAP]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.NATURES_RENEWAL]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.PROTECT_ME]: {
    categories: ['Command'],
    castTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.GUARD]: {
    categories: ['Command'],
    castTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.SIC_EM]: {
    // Command duration belongs to the selected command skill for either recipient.
    duration: 10,
    categories: ['Command'],
    castTimeMs: 0,
    effects: [],
    // Instant activation selects the current pet or merged recipient before subsequent impacts.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.sic-em' } }]
  },
  [ID.WATER_SPIRIT]: {
    castTimeMs: 500,
    // Healing has no combat payload under the fixed-full-health simulation assumption.
    effects: [
      ...spiritSlam([{ type: 'custom', eventType: 'marker', event: { name: 'Aqua Surge' } }]),
      spiritShakes(boonKey(BOON.VIGOR), 2)
    ]
  },
  [ID.AQUA_SURGE]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.WE_HEAL_AS_ONE]: {
    categories: ['Command'],
    castTimeMs: 920,
    // These non-emitting templates provide the duration menu for the live two-way copy.
    effects: [
      { type: 'boon', when: () => false, boon: BOON.AEGIS, duration: 5 },
      { type: 'boon', when: () => false, boon: BOON.ALACRITY, duration: 3 },
      { type: 'boon', when: () => false, boon: BOON.FURY, duration: 3 },
      { type: 'boon', when: () => false, boon: BOON.MIGHT, duration: 10 },
      { type: 'boon', when: () => false, boon: BOON.PROTECTION, duration: 2 },
      { type: 'boon', when: () => false, boon: BOON.QUICKNESS, duration: 2 },
      { type: 'boon', when: () => false, boon: BOON.REGENERATION, duration: 5 },
      { type: 'boon', when: () => false, boon: BOON.RESISTANCE, duration: 2 },
      { type: 'boon', when: () => false, boon: BOON.RESOLUTION, duration: 5 },
      { type: 'boon', when: () => false, boon: BOON.STABILITY, duration: 3 },
      { type: 'boon', when: () => false, boon: BOON.SWIFTNESS, duration: 3 },
      { type: 'boon', when: () => false, boon: BOON.VIGOR, duration: 3 }
    ],
    // Activate the intrinsic reward at its declared boundary, before common trait observers.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.copy-healing-boons' } }]
  }
});

/** Copy both actors from one executed-time snapshot so the first copy never feeds the second. */
function copyHealingBoons(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const activePet = runtime.profession.core.pet;
  const companionId = activePet?.id ?? null;
  const copies = (cast.skill.effects ?? [])
    .filter((effect) => effect.type === 'boon')
    .map((effect) => {
      const kind = String(effect.boon).toLowerCase();
      const player = runtime.combat.boonSnapshot(kind, runtime.time, { actor: ACTOR.PLAYER }).stacks;
      return {
        kind,
        duration: Number(effect.duration),
        player,
        pet: activePet
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
      runtime.effects.emit({
        kind: 'packet',
        event: { ...event, stacks: pet, audience: { recipients: RECIPIENT.SELF } }
      });

    if (activePet && player > 0)
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...event,
          stacks: player,
          audience: {
            recipients: RECIPIENT.SUMMONS,
            affectsSelf: false,
            maximumRecipients: 1,
            eligibleCompanionIds: [activePet.id]
          }
        }
      });
  }
}

/** Solar Flare is the summon's child skill; each initial or repeated slam delivers its authored Burning. */
export function emitSunSpiritBurning(runtime: RangerRuntime, skill: Skill, at: number): void {
  const solarFlare = runtime.helpers.skillsById.get(ID.SOLAR_FLARE);

  if (!solarFlare) throw new Error('Sun Spirit requires the Solar Flare skill.');

  emitRangerProfile(runtime, at, solarFlare, {
    attribution: {
      source: 'ranger',
      sourceId: solarFlare.id,
      actorType: ACTOR.PLAYER,
      skillId: solarFlare.id,
      skillName: solarFlare.name,
      triggeredBy: skill.name
    },
    name: `${solarFlare.name} - Burning`
  });
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
      actorType: ACTOR.PLAYER,
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
function activateSicEm(runtime: RangerRuntime, skill: Skill): void {
  const merged = rangerMerged(runtime.profession);
  for (const kind of [...(runtime.profession.core.pet ? ['sic-em-pet'] : []), ...(merged ? ['sic-em'] : [])])
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
                  recipients: RECIPIENT.SUMMONS,
                  affectsSelf: false,
                  maximumRecipients: 1,
                  eligibleCompanionIds: [rangerPetCompanionId(runtime)]
                }
              : { recipients: RECIPIENT.SELF },
          priority: -20,
          stacks: 1,
          duration: skillNumber(skill, 'duration')
        },
        'buff'
      )
    });
}

/** Hold deployed trap packets until explicit engagement, preserving their relative pulses and field lifetime. */
export function prepareFrostTrapEvent(runtime: RangerRuntime, event: SimulationEventBase): SimulationEventBase | null {
  if (
    runtime.engagement.explicit &&
    runtime.engagement.boundaryPending &&
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
  // Grants sort by expiry: spend the earliest deadline, and still prune on ineligible hits.
  state.sharpeningStoneGrants = activeChargeGrants(state.sharpeningStoneGrants, event.at);

  if (!isPlayerStrike(event) || !(Number(event.coefficient) > 0)) return;

  deliverChargedHit(
    context,
    event,
    ID.SHARPENING_STONE,
    'sharpening-stone',
    () => consumeChargeBatch(state.sharpeningStoneGrants, event.at) !== undefined,
    {
      attribution: {
        source: 'ranger',
        sourceId: ID.SHARPENING_STONE,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        skillId: ID.SHARPENING_STONE,
        skillName: 'Sharpening Stone',
        triggeredBy: event.skillName
      },
      name: 'Sharpening Stone - Bleeding'
    }
  );
}

/** Queue grants at the declared activation boundary so same-time hits retain their established order. */
export const sharpeningStoneLifecycle = {
  sideEffectHandlers: {
    'ranger.sharpening-stone'(runtime, context) {
      if (context.kind === 'cast') grantSkillCharges(runtime, context.cast, 'ranger.sharpening-stone');
    }
  },
  eventHandlers: { 'ranger.sharpening-stone': handleRangerSharpeningStone }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** Soulbeast registers the accepted player command bonus separately from its pet recipient. */
export const sicEmPlayerModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-player',
    order: 102,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) => activeBuff(context, 'sic-em')
  }
]);

/** Pet command grants affect only their eligible companion audience. */
export const sicEmPetModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => rangerPetEvent(context) && activeBuff(context, 'sic-em-pet')
  }
]);

// Player strikes grant Might to the current pet, or to the player while merged in Beastmode.
export function triggerStrengthOfThePack(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event)) return;

  const pet = context.profession.core.pet;
  const merged = rangerMerged(context.profession);

  // Beastmode receives the pet's on-hit Might itself; an absent, unmerged pet has no recipient.
  if (!merged && !pet) return;

  // Only the Ranger's own live Strength of the Pack window arms the proc.
  if (context.combat.activeBuffStacks('strength-of-the-pack', event.at, 1) === 0) return;

  emitRangerAction(context, event.at, requireSkillFromContext(context, ID.STRENGTH_OF_THE_PACK), 'triggered-might', {
    attribution: {
      source: 'ranger',
      sourceId: ID.STRENGTH_OF_THE_PACK,
      actorType: ACTOR.EFFECT,
      skillId: ID.STRENGTH_OF_THE_PACK,
      skillName: '"Strength of the Pack!"',
      triggeredBy: event.skillName
    },
    name: '"Strength of the Pack!" - Might',
    fields: {
      audience: merged
        ? { recipients: RECIPIENT.SELF }
        : {
            recipients: RECIPIENT.SUMMONS,
            affectsSelf: false,
            maximumRecipients: 5,
            eligibleCompanionIds: [pet!.id]
          }
    },
    durationContext: event
  });
}

/** Spirits deliver their slam payloads after the committed summon's shared delay. */
export const spiritLifecycle = {
  sideEffectHandlers: {
    'ranger.sun-spirit'(runtime, context) {
      // Solar Flare lands with the first shake, after the same summon delay as every other spirit.
      emitSunSpiritBurning(runtime, context.skill, runtime.time + RANGER_SPIRIT_SLAM_DELAY_MS / 1000);
    },
    'ranger.storm-spirit'(runtime, context) {
      // Spirit damage is an independent child, so later pet swaps cannot cancel its slam.
      if (context.kind === 'cast')
        emitStormSpiritSlam(runtime, context.cast, runtime.time + RANGER_SPIRIT_SLAM_DELAY_MS / 1000);
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** Command recipients are selected at activation, before subsequent impacts. */
export const sicEmLifecycle = {
  sideEffectHandlers: {
    'ranger.sic-em'(runtime, context) {
      activateSicEm(runtime, context.skill);
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** The heal copies both actors' boons at its committed impact. */
export const weHealAsOneLifecycle = {
  sideEffectHandlers: {
    'ranger.copy-healing-boons'(runtime, context) {
      if (context.kind === 'cast') copyHealingBoons(runtime, context.cast);
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
