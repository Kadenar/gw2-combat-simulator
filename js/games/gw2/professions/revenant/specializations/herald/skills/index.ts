/**
 * Owns Herald facet, consume, stance, and legend-call skill definitions.
 * Facet runtime state remains under sibling `mechanics/` modules.
 */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, CONTROL, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { HERALD_NATURE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/facet-of-nature.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

export const HERALD_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> =
  composeSkillDefinitions<RevenantSkill>(
    {
      [ID.FACET_OF_STRENGTH]: {
        name: 'Facet of Strength',
        icon: 'https://render.guildwars2.com/file/26296CDACD6C4E4A785F305D47523029786B79B9/1013013.png',
        type: 'Utility',
        slot: 'Utility',
        cooldown: 0,
        energyCost: 0,
        upkeepCost: 2,
        legendId: 'LegendaryDragon',
        facet: true,
        pulseInterval: 3,
        upkeepPulse: { kind: boonKey(BOON.MIGHT), duration: 12, stacks: 1 },
        // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
        castTimeMs: 0,
        effects: [],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.start-facet' } }
        ]
      },
      [ID.FACET_OF_ELEMENTS]: {
        name: 'Facet of Elements',
        icon: 'https://render.guildwars2.com/file/C1EC3E559DFB120A41FD3750DABD616BBA9172F9/1013012.png',
        type: 'Utility',
        slot: 'Utility',
        cooldown: 0,
        energyCost: 0,
        upkeepCost: 1,
        legendId: 'LegendaryDragon',
        facet: true,
        pulseInterval: 3,
        upkeepPulse: { kind: boonKey(BOON.SWIFTNESS), duration: 3, stacks: 1 },
        // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
        castTimeMs: 0,
        effects: [],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.start-facet' } }
        ]
      },
      [ID.GAZE_OF_DARKNESS]: {
        name: 'Gaze of Darkness',
        icon: 'https://render.guildwars2.com/file/E05F0225C30E3A5CBD3428AADE0907E3FA4068C1/1013009.png',
        type: 'Utility',
        slot: 'Utility',
        cooldown: 15,
        energyCost: 0,
        legendId: 'LegendaryDragon',
        consume: true,
        // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
        castTimeMs: 0,
        effects: [
          {
            type: 'condition',
            condition: CONDITION.VULNERABILITY,
            stacks: 10,
            duration: 6,
            actorType: ACTOR.PLAYER
          },
          {
            type: 'condition',
            condition: 'Revealed',
            stacks: 1,
            duration: 5,
            actorType: ACTOR.PLAYER
          },
          {
            type: 'condition',
            condition: CONDITION.BLINDNESS,
            stacks: 1,
            duration: 5,
            actorType: ACTOR.PLAYER
          }
        ],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          {
            on: 'castStart',
            when: (_runtime, cast) => !cast.cancelledBeforeCommit,
            do: { type: 'revenant.start-consume' }
          },
          { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
        ]
      },
      [ID.ELEMENTAL_BLAST]: {
        name: 'Elemental Blast',
        icon: 'https://render.guildwars2.com/file/CA0D081DBD97A356D2C1BE5A6710587EBD0E3911/1013010.png',
        type: 'Utility',
        slot: 'Utility',

        cooldown: 12,
        energyCost: 0,
        legendId: 'LegendaryDragon',
        consume: true,
        // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
        castTimeMs: 480,
        // Once released, the blast keeps its pulses and cast lockout through an aftercast interruption.
        interruptCommitMs: 360,
        retainsCastLockoutAfterInterrupt: true,
        // Share timing defaults while preserving each packet, effect order, and local schedule.
        effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
          {
            type: 'strike',
            name: 'Elemental Blast',
            actorType: ACTOR.PLAYER,
            ticks: [
              {
                atMs: 280,
                coefficient: 1.5,
                name: 'Elemental Blast - Pulse 1'
              },
              {
                atMs: 1280,
                coefficient: 1.5,
                name: 'Elemental Blast - Pulse 2'
              },
              {
                atMs: 2280,
                coefficient: 1.5,
                name: 'Elemental Blast - Pulse 3'
              }
            ]
          },
          {
            type: 'condition',
            actorType: ACTOR.PLAYER,
            ticks: [
              {
                atMs: 280,
                condition: CONDITION.WEAKNESS,
                stacks: 1,
                duration: 5
              },
              {
                atMs: 1280,
                condition: CONDITION.CHILLED,
                stacks: 1,
                duration: 3
              },
              {
                atMs: 2280,
                condition: CONDITION.BURNING,
                stacks: 2,
                duration: 4
              }
            ]
          }
        ]),
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          {
            on: 'castStart',
            when: (_runtime, cast) => !cast.cancelledBeforeCommit,
            do: { type: 'revenant.start-consume' }
          },
          { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
        ]
      },
      [ID.FACET_OF_LIGHT]: {
        name: 'Facet of Light',
        icon: 'https://render.guildwars2.com/file/1F723B516AC5B614943543EECE6938E13349B90E/1012991.png',
        type: 'Heal',
        slot: 'Heal',
        cooldown: 0,
        energyCost: 0,
        upkeepCost: 1,
        legendId: 'LegendaryDragon',
        facet: true,
        pulseInterval: 3,
        upkeepPulse: { kind: boonKey(BOON.REGENERATION), duration: 4, stacks: 1 },
        // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
        castTimeMs: 200,
        effects: [],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.start-facet' } }
        ]
      },
      [ID.INFUSE_LIGHT]: {
        name: 'Infuse Light',
        icon: 'https://render.guildwars2.com/file/051BD6BDCB2D451AB4E91F45F0DF339ACE12193E/1012990.png',
        type: 'Heal',
        slot: 'Heal',
        cooldown: 30,
        energyCost: 0,
        legendId: 'LegendaryDragon',
        consume: true,
        // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
        castTimeMs: 0,
        effects: [],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          {
            on: 'castStart',
            when: (_runtime, cast) => !cast.cancelledBeforeCommit,
            do: { type: 'revenant.start-consume' }
          },
          { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
        ]
      },
      [ID.FACET_OF_CHAOS]: {
        name: 'Facet of Chaos',
        icon: 'https://render.guildwars2.com/file/E5F7EC66C065EAB56631BA0CD1CF6F4D03B89270/1012986.png',
        type: 'Elite',
        slot: 'Elite',
        cooldown: 0,
        energyCost: 0,
        upkeepCost: 4,
        legendId: 'LegendaryDragon',
        facet: true,
        pulseInterval: 3,
        upkeepPulse: { kind: boonKey(BOON.PROTECTION), duration: 3, stacks: 1 },
        // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
        castTimeMs: 0,
        effects: [],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.start-facet' } }
        ]
      },
      [ID.CHAOTIC_RELEASE]: {
        name: 'Chaotic Release',
        icon: 'https://render.guildwars2.com/file/055C20EB05B2EA1561E1CF2F297277EC6F07FA75/1012985.png',
        type: 'Elite',
        slot: 'Elite',
        cooldown: 20,
        energyCost: 0,
        legendId: 'LegendaryDragon',
        consume: true,
        // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
        castTimeMs: 600,
        // Share one impact timing while preserving independent payloads and declaration order.
        effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
          {
            type: 'strike',
            coefficient: 4,
            hits: 1,
            name: 'Chaotic Release',
            actorType: ACTOR.PLAYER
          },
          {
            type: 'control',
            actorType: ACTOR.PLAYER,
            controlKind: CONTROL.KNOCKBACK
          },
          {
            type: 'buff',
            kind: STATUS.SUPERSPEED,
            duration: 5,
            stacks: 1
          }
        ]),
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          {
            on: 'castStart',
            when: (_runtime, cast) => !cast.cancelledBeforeCommit,
            do: { type: 'revenant.start-consume' }
          },
          { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
        ]
      },
      [ID.BURST_OF_STRENGTH]: {
        name: 'Burst of Strength',
        icon: 'https://render.guildwars2.com/file/91F9252B1F3C71C934B75502B8DD070A064115D8/1013008.png',
        type: 'Utility',
        slot: 'Utility',
        cooldown: 12,
        energyCost: 0,
        legendId: 'LegendaryDragon',
        consume: true,
        // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
        castTimeMs: 840,
        // Share timing defaults while preserving each packet, effect order, and local schedule.
        effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
          {
            type: 'strike',
            ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 3.2 / 2 })),
            name: 'Burst of Strength',
            actorType: ACTOR.PLAYER
          },
          {
            type: 'buff',
            kind: 'burst-of-strength',
            duration: 10,
            stacks: 1,
            atMs: 360
          }
        ]),
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          {
            on: 'castStart',
            when: (_runtime, cast) => !cast.cancelledBeforeCommit,
            do: { type: 'revenant.start-consume' }
          },
          { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
        ]
      },
      [ID.FACET_OF_DARKNESS]: {
        name: 'Facet of Darkness',
        icon: 'https://render.guildwars2.com/file/15A4F87D0E05936FF96B60F8745ADB513C5308E3/1013011.png',
        type: 'Utility',
        slot: 'Utility',
        cooldown: 0,
        energyCost: 0,
        upkeepCost: 2,
        legendId: 'LegendaryDragon',
        facet: true,
        pulseInterval: 3,
        upkeepPulse: { kind: boonKey(BOON.FURY), duration: 3, stacks: 1 },
        // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
        castTimeMs: 0,
        effects: [],
        // The declaration owns this activation; shared mechanics retain its live state.
        sideEffects: [
          { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
          { on: 'castCommit', do: { type: 'revenant.start-facet' } }
        ]
      }
    },
    HERALD_NATURE_SKILL_MECHANICS,
    {
      [ID.LEGENDARY_DRAGON_STANCE]: {
        name: 'Legendary Dragon Stance',
        icon: 'https://render.guildwars2.com/file/27B5D1D4127A2EE73866E54F5A43E9102618B90B/1058605.png',
        type: 'Profession',
        slot: 'Profession_1',
        cooldown: 0,
        energyCost: 0,
        castTimeMs: 0,
        effects: []
      },
      [ID.CALL_OF_THE_DRAGON]: {
        name: 'Call of the Dragon',
        icon: 'https://render.guildwars2.com/file/27B5D1D4127A2EE73866E54F5A43E9102618B90B/1058605.png',
        type: 'Action',
        slot: 'Action',
        cooldown: 0,
        energyCost: 0,
        castTimeMs: 0,
        effects: [
          {
            type: 'strike',
            coefficient: 0.75,
            hits: 1,
            name: 'Call of the Dragon',
            actorType: ACTOR.PLAYER
          },
          {
            type: 'condition',
            condition: CONDITION.BURNING,
            stacks: 2,
            duration: 3,
            actorType: ACTOR.PLAYER
          },
          {
            type: 'condition',
            condition: CONDITION.CHILLED,
            stacks: 1,
            duration: 3,
            actorType: ACTOR.PLAYER
          }
        ]
      }
    }
  );

/** Burst of Strength's distinct damage rules share a skill identity and label in reference views. */
export const burstOfStrengthModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.burst-of-strength-strike',
    sourceSkillId: ID.BURST_OF_STRENGTH,
    label: 'Burst of Strength',
    order: 101,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // "burst-of-strength" is a timed buff key written by the skill handler, not a boon; it uses buffActive rather than boon tracking.
    amount: 0.1,
    when: (context) => buffActive(context, 'burst-of-strength')
  },
  {
    id: 'revenant.burst-of-strength-condition',
    sourceSkillId: ID.BURST_OF_STRENGTH,
    label: 'Burst of Strength',
    order: 102,
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => buffActive(context, 'burst-of-strength')
  }
]);
