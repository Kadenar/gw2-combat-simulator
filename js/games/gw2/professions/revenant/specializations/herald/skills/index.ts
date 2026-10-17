import { BOON, boonKey } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
import { HERALD_NATURE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/facet-of-nature.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
/**
 * Owns Herald facet, consume, stance, and legend-call skill fragments.
 * Facet runtime state remains under sibling `mechanics/` modules.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

export const HERALD_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FACET_OF_STRENGTH]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.start-facet' } }
    ],
    // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 2,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: boonKey(BOON.MIGHT), duration: 12, stacks: 1 }
  },
  [ID.FACET_OF_ELEMENTS]: {
    // The API omits this flip; declare its consume here so selected catalogs own the relationship.
    flipSkillId: ID.ELEMENTAL_BLAST,
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.start-facet' } }
    ],
    // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 1,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: boonKey(BOON.SWIFTNESS), duration: 3, stacks: 1 }
  },
  [ID.GAZE_OF_DARKNESS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ],
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 0,
    cooldown: 15,
    energyCost: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Revealed',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.ELEMENTAL_BLAST]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ],
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 480,
    // Once released, the blast keeps its pulses and cast lockout through an aftercast interruption.
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 12,
    energyCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        name: 'Elemental Blast',
        actorType: 'player',
        ticks: [
          {
            atMs: 280,
            coefficient: 1.5,
            name: 'Elemental Blast — Pulse 1'
          },
          {
            atMs: 1280,
            coefficient: 1.5,
            name: 'Elemental Blast — Pulse 2'
          },
          {
            atMs: 2280,
            coefficient: 1.5,
            name: 'Elemental Blast — Pulse 3'
          }
        ]
      },
      {
        type: 'condition',
        actorType: 'player',
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
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_LIGHT]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.start-facet' } }
    ],
    // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
    castTimeMs: 200,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 1,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: boonKey(BOON.REGENERATION), duration: 4, stacks: 1 }
  },
  [ID.INFUSE_LIGHT]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ],
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 0,
    cooldown: 30,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_CHAOS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.start-facet' } }
    ],
    // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 4,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: boonKey(BOON.PROTECTION), duration: 3, stacks: 1 }
  },
  [ID.CHAOTIC_RELEASE]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ],
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 600,
    cooldown: 20,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1,
        name: 'Chaotic Release',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback'
      },
      {
        type: 'buff',
        kind: 'superspeed',
        duration: 5,
        stacks: 1
      }
    ]),
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.BURST_OF_STRENGTH]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ],
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 840,
    cooldown: 12,
    energyCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 3.2 / 2 })),
        name: 'Burst of Strength',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'burst-of-strength',
        duration: 10,
        stacks: 1,
        atMs: 360
      }
    ]),
    legendId: 'LegendaryDragon',
    consume: true
  },
  [ID.FACET_OF_DARKNESS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.start-facet' } }
    ],
    // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    upkeepCost: 2,
    effects: [],
    legendId: 'LegendaryDragon',
    facet: true,
    pulseInterval: 3,
    upkeepPulse: { kind: boonKey(BOON.FURY), duration: 3, stacks: 1 }
  },
  ...HERALD_NATURE_SKILL_MECHANICS,
  [ID.LEGENDARY_DRAGON_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.CALL_OF_THE_DRAGON]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1,
        name: 'Call of the Dragon',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }
});

/** Burst of Strength grants distinct strike and condition bonuses during its timed buff. */
export const burstOfStrengthModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.burst-of-strength-strike',
    order: 101,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // "burst-of-strength" is a timed buff key written by the skill handler, not a boon; it uses buffActive rather than boon tracking.
    amount: 0.1,
    when: (context) => buffActive(context, 'burst-of-strength')
  },
  {
    id: 'revenant.burst-of-strength-condition',
    order: 102,
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => buffActive(context, 'burst-of-strength')
  }
]);
