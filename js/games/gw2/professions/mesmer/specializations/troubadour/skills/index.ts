/**
 * Owns Troubadour instrument, Tale, and simulator-action catalog data.
 * Instrument and Tale runtime behavior lives under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/skills/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

// Tales share one lifecycle trigger; their specialization resolver owns each Tale's distinct outcome.
const TROUBADOUR_TALE_TRIGGERS = Object.freeze([
  {
    type: 'mesmer.troubadour.resolve-tale',
    timingAnchor: 'castEnd' as const
  }
]);

export const MESMER_TROUBADOUR_SKILL_MECHANICS: Readonly<
  Record<SkillId, SkillFragment & { readonly instrument?: MesmerInstrument }>
> = Object.freeze({
  [ID.TROUBADOUR_BLADECALL]: {
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.25
          },
          {
            atMs: 200,
            coefficient: 0.25
          },
          {
            atMs: 200,
            coefficient: 0.25
          }
        ],
        name: 'Outgoing damage',
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2720,
            coefficient: 0.25
          },
          {
            atMs: 2720,
            coefficient: 0.25
          },
          {
            atMs: 2760,
            coefficient: 0.25
          }
        ],
        name: 'Returning damage',
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      }
    ],
    castTimeMs: 440
  },
  [ID.LIVELY_LUTE]: {
    castTimeMs: 560,
    // Preserve the performance when interruption only skips the remaining recovery.
    interruptCommitMs: 520,
    instrument: {
      slot: 1,
      instrument: 'Lute',
      damageAtMs: 440,
      // All launched notes survive an interruption after the performance commits.
      persistsAfterInterrupt: true,
      // Player and afterimage performances share these three note packets.
      ticks: [
        { atMs: 0, coefficient: 1 },
        { atMs: 200, coefficient: 1 },
        { atMs: 400, coefficient: 1 }
      ]
    },
    effects: []
  },
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 4,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 4,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.TALE_OF_THE_SECOND_SCION]: {
    castTimeMs: 666.666666667,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.FLUSTERING_FLUTE]: {
    castTimeMs: 560,
    instrument: {
      slot: 2,
      instrument: 'Flute',
      coefficient: 1,
      hits: 1,
      damageAtMs: 360,
      conditions: [{ name: 'Confusion', duration: 4, stacks: 3 }]
    },
    effects: [
      // Performance and afterimage impacts materialize the same authored control.
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TALE_OF_THE_SOULKEEPER]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.CRESCENDO]: {
    castTimeMs: 1000,
    damageAtMs: 840,
    effects: []
  },
  [ID.HARMONIOUS_HARP]: {
    // Harp packets remain valid independently when the channel is interrupted.
    castTimeMs: 2000,
    // End the channel early by default once Harp Playing is active.
    defaultInterruptMs: 480,
    interruptMode: 'per-packet',
    instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0 },
    effects: []
  },
  [ID.TALE_OF_THE_AUGUST_QUEEN]: {
    castTimeMs: 666.666666667,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: {
    castTimeMs: 400,
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 1360, 2360, 3360].map((atMs) => ({ atMs, coefficient: 1 })),
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [360, 1360, 2360, 3360].map((atMs) => ({ atMs, condition: 'Torment', duration: 8, stacks: 1 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Weakness', stacks: 1, duration: 5 }]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1360, condition: 'Vulnerability', stacks: 10, duration: 4 }]
      },
      {
        type: 'control',
        atMs: 3360
      }
    ])
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    // Both Harp variants preserve packets independently when interrupted.
    castTimeMs: 2000,
    // Use the same default early channel end for the alternate Harp.
    defaultInterruptMs: 480,
    interruptMode: 'per-packet',
    instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0 },
    effects: []
  },
  [ID.DEAFENING_DRUM]: {
    castTimeMs: 680,
    // The report's 600 ms Drum still lands its impact and delayed wave; preserve that committed performance.
    interruptCommitMs: 600,
    instrument: {
      slot: 3,
      instrument: 'Drum',
      coefficient: 2,
      hits: 1,
      damageAtMs: 520
    },
    effects: [
      // Performance and afterimage impacts materialize the same authored control.
      {
        type: 'control',
        source: 'Player',
        controlKind: 'stun',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    mechanicTriggers: TROUBADOUR_TALE_TRIGGERS,
    effects: []
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    castTimeMs: 560,
    // Both Lute variants share the same performance commit point.
    interruptCommitMs: 520,
    instrument: {
      slot: 1,
      instrument: 'Lute',
      damageAtMs: 440,
      // The alternate performance preserves the same launched note sequence.
      persistsAfterInterrupt: true,
      ticks: [
        { atMs: 0, coefficient: 1 },
        { atMs: 200, coefficient: 1 },
        { atMs: 400, coefficient: 1 }
      ]
    },
    effects: []
  }
});

// Derive runtime and balance-profile inputs from the skill records so instrument behavior has one authoring site.
export const MESMER_TROUBADOUR_INSTRUMENTS: Readonly<Record<number, MesmerInstrument>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_TROUBADOUR_SKILL_MECHANICS).flatMap(([skillId, skill]) =>
      skill.instrument ? [[Number(skillId), skill.instrument]] : []
    )
  )
);

export const MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze(
  {}
);

export const MESMER_TROUBADOUR_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.DODGE_TROUBADOUR,
    name: 'Dodge',
    description: 'Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    specialization: 'Troubadour',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    ammo: 2,
    // Mayhem reacts to the completed dodge rather than a Core Mesmer skill-id branch.
    mechanicTriggers: [
      {
        type: 'mesmer.troubadour.dodge',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
] satisfies readonly MesmerSkill[]);
