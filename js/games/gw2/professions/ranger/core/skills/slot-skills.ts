// Verified skill icons use ArenaNet render URLs directly so they share the simulator's CDN fallback handling.
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { appendChargeGrant, consumeChargeBatch, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { type SkillEffect, type StatusEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
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

/** Canonical Core ranger skill definitions grouped by their GW2 owner. */

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

export const RANGER_CORE_SLOT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.SPIKE_TRAP]: {
    name: 'Spike Trap',
    icon: 'https://render.guildwars2.com/file/B811D9DBB9D4D8459B4F1E21BBC06FF5A9422A77/103283.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Trap',
    cooldown: 25,
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
    name: 'Troll Unguent',
    icon: 'https://render.guildwars2.com/file/5DBD13DA0EF70A3F0CA42857B72E950B6C76FDDC/103987.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    castTimeMs: 500,
    effects: []
  },
  [ID.HEALING_SPRING]: {
    name: 'Healing Spring',
    icon: 'https://render.guildwars2.com/file/F6C2FD7E78EE0D9178AEAEF8B1666477D1E92C99/103544.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Trap',
    cooldown: 24,
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
    name: 'Signet of the Wild',
    icon: 'https://render.guildwars2.com/file/C5C6F15A60FA590B2810DE5023E7402964190496/103542.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cooldown: 30,
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
    name: 'Frost Trap',
    icon: 'https://render.guildwars2.com/file/016A1099CAC468ADEE056A30551C33C74101E5D3/103074.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Trap',
    cooldown: 30,
    castTimeMs: 600,
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
    name: 'Storm Spirit',
    icon: 'https://render.guildwars2.com/file/42B863334A6F66D64BC0DDD798959EEB15650F02/103993.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
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
    name: 'Stone Spirit',
    icon: 'https://render.guildwars2.com/file/65802D0CA90F904046542B78A79B48EB3745C244/103994.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 25,
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
    name: "Viper's Nest",
    icon: 'https://render.guildwars2.com/file/AA04EAA1350C060903E120004FB909F3DC0FDE58/103197.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Trap',
    cooldown: 20,
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
    name: 'Frost Spirit',
    icon: 'https://render.guildwars2.com/file/527D04E6562149B046DE7D41F312FE0100BF446E/103995.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
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
    name: 'Sun Spirit',
    icon: 'https://render.guildwars2.com/file/C24EEF13ACFB15A8750BDA070F52A3AB6826A714/103944.png',
    type: 'Utility',
    slot: 'Utility',

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
    name: 'Flame Trap',
    icon: 'https://render.guildwars2.com/file/B8652FF3DDA8EB67A540ECF73633EB4BFAA19E9A/103865.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Trap',
    cooldown: 15,
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
    name: 'Muddy Terrain',
    icon: 'https://render.guildwars2.com/file/B6BD062BE66079C0514191004BB1D1140112E2A1/103996.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
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
    name: '"Strength of the Pack!"',
    icon: 'https://render.guildwars2.com/file/B77111BD4468FB297D560A44EE5F023425915FBF/103606.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 60,
    skillFamily: 'Command',
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
    name: 'Sharpening Stone',
    icon: 'https://render.guildwars2.com/file/662329DDE4D8C7DFB30DD3D1E8CAB807FACBF66A/104004.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 30,
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
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
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
    name: 'Spirit of Nature',
    icon: 'https://render.guildwars2.com/file/E23D450D539B92FE0D36DEDF1B2D6010A961E612/104011.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 90,
    castTimeMs: 1000,
    // Revival has no combat payload while all players remain alive at full health.
    effects: [
      ...spiritSlam([{ type: 'custom', eventType: 'marker', event: { name: "Nature's Renewal" } }]),
      spiritShakes(boonKey(BOON.REGENERATION), 3)
    ]
  },
  [ID.ENTANGLE]: {
    name: 'Entangle',
    icon: 'https://render.guildwars2.com/file/F532ED0DCE2AC7F4D51137B346D2F17AD006EC11/103101.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 60,
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
    name: 'Solar Flare',
    // Use the dedicated spirit icon for result rows.
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
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
    name: 'Call Lightning',
    // Use the dedicated spirit icon for result rows.
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
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
    name: 'Quake',
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
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
    name: 'Cold Snap',
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 0,
    castTimeMs: 500,
    effects: []
  },
  [ID.NATURES_RENEWAL]: {
    name: "Nature's Renewal",
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 0,
    castTimeMs: 500,
    effects: []
  },
  [ID.PROTECT_ME]: {
    name: '"Protect Me!"',
    icon: 'https://render.guildwars2.com/file/41121EEEF99A6F50130E323EA107024C53A809BD/104023.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 24,
    skillFamily: 'Command',
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
    name: '"Guard!"',
    icon: 'https://render.guildwars2.com/file/CAF0C9FF0BAE4C32B3D01009A2ED0C063BDFD8AC/104024.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 24,
    skillFamily: 'Command',
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
    name: '"Sic \'Em!"',
    icon: 'https://render.guildwars2.com/file/0D6B235E679346723414607E61DE052576097545/104025.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 28,
    // Command duration belongs to the selected command skill for either recipient.
    duration: 10,
    skillFamily: 'Command',
    castTimeMs: 0,
    // Accepted player grants retain Soulbeast eligibility independently of the command skill.
    modifiers: [
      // The pet grant affects only eligible companion packets.
      {
        id: 'ranger.sic-em-pet',
        scope: 'profession',
        order: 30,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.4,
        when: (context) => rangerPetEvent(context) && activeBuff(context, 'sic-em-pet')
      },
      {
        id: 'ranger.sic-em-player',
        scope: 'profession',
        order: 102,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.25,
        when: (context) =>
          (context.runtime
            ? readProfessionSpecializationState(context.runtime.profession, 'Soulbeast') != null
            : context.config?.specialization === 'Soulbeast') && activeBuff(context, 'sic-em')
      }
    ],
    effects: [],
    // Instant activation selects the current pet or merged recipient before subsequent impacts.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.sic-em' } }]
  },
  [ID.WATER_SPIRIT]: {
    name: 'Water Spirit',
    icon: 'https://render.guildwars2.com/file/FA9E444D3AEA9B06F70B96DBBA459A5AB1165BB5/699530.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    castTimeMs: 500,
    // Healing has no combat payload under the fixed-full-health simulation assumption.
    effects: [
      ...spiritSlam([{ type: 'custom', eventType: 'marker', event: { name: 'Aqua Surge' } }]),
      spiritShakes(boonKey(BOON.VIGOR), 2)
    ]
  },
  [ID.AQUA_SURGE]: {
    name: 'Aqua Surge',
    icon: 'https://render.guildwars2.com/file/1D55D34FB4EE20B1962E315245E40CA5E1042D0E/62248.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 0,
    castTimeMs: 500,
    effects: []
  },
  [ID.WE_HEAL_AS_ONE]: {
    name: '"We Heal As One!"',
    icon: 'https://render.guildwars2.com/file/9658B6ACBC0CF618FDEF0C221C9352CA26ED33E2/103175.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 20,
    skillFamily: 'Command',
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
};

/** Copy both actors from one executed-time snapshot so the first copy never feeds the second. */
function copyHealingBoons(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  const activePet = runtime.profession.core.pet;
  const companionId = activePet?.id ?? null;
  const copies = (cast.skill.effects ?? [])
    .filter((effect): effect is StatusEffect => effect.type === 'boon')
    .map((effect) => {
      const kind = String(effect.boon).toLowerCase();
      const player = runtime.combat.boonSnapshot(kind, runtime.time, { actor: ACTOR.PLAYER }).stacks;
      return {
        kind,
        duration: effect.duration,
        player,
        pet: activePet
          ? runtime.combat.boonSnapshot(kind, runtime.time, { actor: 'companion', companionId }).stacks
          : player
      };
    });
  const effects: StatusEffect[] = [];
  for (const { kind, duration, player, pet } of copies) {
    if (pet > 0)
      effects.push({ type: 'boon', boon: kind, duration, stacks: pet, audience: { recipients: RECIPIENT.SELF } });

    if (activePet && player > 0)
      effects.push({
        type: 'boon',
        boon: kind,
        duration,
        stacks: player,
        audience: {
          recipients: RECIPIENT.SUMMONS,
          affectsSelf: false,
          maximumRecipients: 1,
          eligibleCompanionIds: [activePet.id]
        }
      });
  }

  // Both copied audiences belong to the completed heal's one observed activation.
  runtime.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    at: runtime.time,
    cast: { activationId: cast.id, skillId: cast.skill.id },
    attribution: {
      source: 'ranger',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    effects,
    transform: (event) => ({ ...event, name: cast.skill.name })
  });
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

/** Apply each resolved charge grant with its own expiry so recasting does not refresh older stones. */
export function handleRangerSharpeningStone(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context.profession);
  state.sharpeningStoneGrants = appendChargeGrant(
    state.sharpeningStoneGrants,
    grantCharges(Math.trunc(Math.max(0, Number(event.charges || 0))), event.at + (event.duration || 0)),
    event.at,
    'earliest-expiry'
  );
}

/** A positive player strike can consume one live stone and attribute its Bleeding to the utility rather than the weapon. */
export function triggerSharpeningStone(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context.profession);

  if (!isPlayerStrike(event) || !(Number(event.coefficient) > 0)) return;

  deliverChargedHit(
    context,
    event,
    ID.SHARPENING_STONE,
    'sharpening-stone',
    // Grants stay in expiry order, so this spends the earliest live batch and skips expired ones.
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

// Player strikes grant Might to the current pet, or to the player while merged in Beastmode.
export function triggerStrengthOfThePack(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event)) return;

  const pet = context.profession.core.pet;
  const merged = rangerMerged(context.profession);

  // Beastmode receives the pet's on-hit Might itself; an absent, unmerged pet has no recipient.
  if (!merged && !pet) return;

  // Only the Ranger's own live Strength of the Pack window arms the proc.
  if (context.combat.activeBuffStacks('strength-of-the-pack', event.at, 1) === 0) return;

  emitRangerAction(context, event.at, requireSkill(context.helpers, ID.STRENGTH_OF_THE_PACK), 'triggered-might', {
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
