import { createDodgeSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns Troubadour instrument, Tale, and simulator-action catalog data.
 * Instrument and Tale runtime behavior lives under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill, SkillId, SkillEffect, BalanceProfile } from '#gw2/platform/engine/skills/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

// Tales capture eligibility at acceptance and grant their intrinsic rewards at commitment.
const TROUBADOUR_TALE_ACTIONS: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
  { on: 'castCommit', do: { type: 'mesmer.troubadour.resolve-tale' } }
];

/** Player performances materialize the same patchable attacks as afterimages on an explicit cast-start clock. */
function instrumentEffects(profileId: string): NonNullable<Skill['effectVariants']> {
  return [
    {
      profileId,
      when: () => true,
      transform: (_runtime, cast, effects) =>
        [...(cast.skill.effects ?? []), ...effects].map((effect): SkillEffect => {
          const damageAtMs = (cast.skill.instrument as MesmerInstrument).damageAtMs ?? 0;
          const timing = {
            source: 'Player',
            actorType: 'player' as const,
            timingAnchor: 'castStart' as const,
            timingScale: 'fixed' as const,
            atMs: damageAtMs + (effect.atMs ?? 0)
          };
          if (effect.type === 'condition' && effect.ticks)
            return {
              ...effect,
              ...timing,
              ticks: effect.ticks.map((tick) => ({ ...tick, atMs: damageAtMs + tick.atMs }))
            };
          if (effect.type !== 'strike') return { ...effect, ...timing };
          return {
            ...effect,
            ...timing,
            name: cast.skill.name,
            weaponStrengthProfileId: 'nonweapon.profession-mechanic',
            persistsAfterInterrupt: Boolean((cast.skill.instrument as MesmerInstrument).persistsAfterInterrupt),
            ...(effect.ticks ? { ticks: effect.ticks.map((tick) => ({ ...tick, atMs: damageAtMs + tick.atMs })) } : {})
          };
        })
    }
  ];
}

const INSTRUMENT_ACTIONS: NonNullable<Skill['sideEffects']> = [
  { on: 'castStart', do: { type: 'mesmer.troubadour.performance-traits' } },
  { on: 'castCommit', do: { type: 'mesmer.troubadour.commit-instrument' } }
];

export const MESMER_TROUBADOUR_SKILL_MECHANICS: Readonly<
  Record<SkillId, Partial<Skill> & { readonly instrument?: MesmerInstrument }>
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
    sideEffects: INSTRUMENT_ACTIONS,
    effectVariants: instrumentEffects('mesmer.troubadour.lively-lute'),
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
    tale: {
      name: 'Tale of the Honorable Rogue',
      profileId: 'mesmer.troubadour.tale-honorable-rogue',
      instrument: 'Drum',
      resourceGain: 1,
      effects: [{ name: 'aegis', type: 'boon', boon: 'aegis', duration: 4, stacks: 1 }]
    },
    // The instant tale refunds endurance at commitment through the shared capped pool.
    resourceGain: 50,
    sideEffects: [
      ...TROUBADOUR_TALE_ACTIONS,
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ],
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 4,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 4,
    effects: []
  },
  [ID.TALE_OF_THE_SECOND_SCION]: {
    castTimeMs: 666.666666667,
    sideEffects: TROUBADOUR_TALE_ACTIONS,
    effects: []
  },
  [ID.FLUSTERING_FLUTE]: {
    sideEffects: INSTRUMENT_ACTIONS,
    effectVariants: instrumentEffects('mesmer.troubadour.flustering-flute'),
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
    tale: {
      name: 'Tale of the Soulkeeper',
      profileId: 'mesmer.troubadour.tale-soulkeeper',
      instrument: 'Lute',
      resourceGain: 2,
      effects: [
        { name: 'might', type: 'boon', boon: 'might', duration: 15, stacks: 10 },
        { name: 'fury', type: 'boon', boon: 'fury', duration: 10, stacks: 1 },
        { name: 'quickness', type: 'boon', boon: 'quickness', duration: 4, stacks: 1 }
      ]
    },
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    sideEffects: TROUBADOUR_TALE_ACTIONS,
    effects: []
  },
  [ID.CRESCENDO]: {
    // Schedule now, but select active instruments at impact rather than acceptance.
    crescendoProfileId: 'mesmer.troubadour.crescendo',
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.troubadour.schedule-crescendo' } }],
    castTimeMs: 1000,
    damageAtMs: 840,
    effects: []
  },
  [ID.HARMONIOUS_HARP]: {
    sideEffects: [
      ...INSTRUMENT_ACTIONS,
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'emitProfile',
          profileId: 'mesmer.troubadour.instruments',
          effects: (effect) => effect.type === 'buff' && effect.name === 'distortion',
          attribution: { source: 'Player', sourceId: ID.HARMONIOUS_HARP, actorType: 'player' }
        }
      }
    ],
    effectVariants: instrumentEffects('mesmer.troubadour.harmonious-harp'),
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
    sideEffects: TROUBADOUR_TALE_ACTIONS,
    effects: []
  },
  [ID.TALE_OF_THE_TORTURED_MASTERMIND]: {
    tale: {
      name: 'Tale of the Tortured Mastermind',
      profileId: 'mesmer.troubadour.tale-tortured-mastermind',
      instrument: 'Flute',
      resourceGain: 1,
      effects: []
    },
    castTimeMs: 400,
    sideEffects: TROUBADOUR_TALE_ACTIONS,
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
    sideEffects: [
      ...INSTRUMENT_ACTIONS,
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'emitProfile',
          profileId: 'mesmer.troubadour.instruments',
          effects: (effect) => effect.type === 'buff' && effect.name === 'distortion',
          attribution: { source: 'Player', sourceId: ID.HARMONIOUS_HARP_ALTERNATE, actorType: 'player' }
        }
      }
    ],
    effectVariants: instrumentEffects('mesmer.troubadour.harmonious-harp-alternate'),
    // Both Harp variants preserve packets independently when interrupted.
    castTimeMs: 2000,
    // Use the same default early channel end for the alternate Harp.
    defaultInterruptMs: 480,
    interruptMode: 'per-packet',
    instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0 },
    effects: []
  },
  [ID.DEAFENING_DRUM]: {
    sideEffects: INSTRUMENT_ACTIONS,
    effectVariants: instrumentEffects('mesmer.troubadour.deafening-drum'),
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
    tale: {
      name: 'Tale of the Valiant Marshal',
      profileId: 'mesmer.troubadour.tale-valiant-marshal',
      instrument: 'Harp',
      resourceGain: 1,
      effects: [
        { name: 'stability', type: 'boon', boon: 'stability', duration: 4, stacks: 5 },
        { name: 'resistance', type: 'boon', boon: 'resistance', duration: 3, stacks: 1 }
      ]
    },
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    sideEffects: TROUBADOUR_TALE_ACTIONS,
    effects: []
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    sideEffects: INSTRUMENT_ACTIONS,
    effectVariants: instrumentEffects('mesmer.troubadour.lively-lute-alternate'),
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

export const MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, Partial<Skill>>> = Object.freeze(
  {}
);

export const MESMER_TROUBADOUR_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  createDodgeSkill({
    description: 'Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.',
    specialization: 'Troubadour',
    castTimeMs: 0,
    resourceCost: 50,
    cost: { resource: 'endurance', spendOn: 'castCommit' },
    tasks: [
      {
        type: 'mesmer.troubadour.dodge',
        timingAnchor: 'castEnd'
      }
    ]
  })
] satisfies readonly MesmerSkill[]);

// The patch registry consumes these declarations without duplicating Tale balance values.
export const TROUBADOUR_TALE_PROFILES: readonly BalanceProfile[] = Object.entries(
  MESMER_TROUBADOUR_SKILL_MECHANICS
).flatMap(([id, skill]) => {
  const tale = skill.tale as MesmerSkill['tale'];
  return tale
    ? [
        {
          id: tale.profileId,
          parentId: Number(id),
          name: tale.name,
          profileKind: 'skill-variant',
          resourceGain: tale.resourceGain,
          effects: tale.effects
        }
      ]
    : [];
});

// Harp declares its start-time protection independently of the later playing-state transaction.
export const HARMONIOUS_HARP_DISTORTION: SkillEffect = {
  name: 'distortion',
  type: 'buff',
  kind: 'distortion',
  duration: 2,
  stacks: 1
};
