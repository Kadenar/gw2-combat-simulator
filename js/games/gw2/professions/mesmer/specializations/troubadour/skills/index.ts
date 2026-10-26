import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { ACTOR, CONTROL, BOON, CONDITION, AURA, RECIPIENT } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { createDodgeSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns Troubadour instrument, Tale, and simulator-action catalog data.
 * Instrument and Tale runtime behavior lives under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { cryOfPainConfusion } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillId, BalanceProfile } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

// Tales capture eligibility at acceptance and grant their intrinsic rewards at commitment.
const TROUBADOUR_TALE_ACTIONS: NonNullable<MesmerSkill['sideEffects']> = [
  { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
  { on: 'castCommit', do: { type: 'mesmer.troubadour.resolve-tale' } }
];

/** Cry of Pain augments only the player's Flute performance; afterimages keep the native conditions. */
function traitedInstrumentConditions(
  runtime: unknown,
  effects: readonly SkillEffect[],
  cryOfPainProfileId: string | undefined
): readonly SkillEffect[] {
  if (!cryOfPainProfileId) return effects;

  return effects.map((effect) =>
    effect.type === 'condition' && effect.condition === CONDITION.CONFUSION
      ? cryOfPainConfusion(runtime, effect, cryOfPainProfileId)!
      : effect
  );
}

/** Player performances materialize the same patchable attacks as afterimages on an explicit cast-start clock. */
function instrumentEffects(profileId: string, cryOfPainProfileId?: string): NonNullable<MesmerSkill['effectVariants']> {
  return [
    {
      profileId,
      when: () => true,
      transform: (runtime, cast, effects) =>
        [...(cast.skill.effects ?? []), ...traitedInstrumentConditions(runtime, effects, cryOfPainProfileId)].map(
          (effect): SkillEffect => {
            const damageAtMs = (cast.skill.instrument as MesmerInstrument).damageAtMs ?? 0;
            const timing = {
              source: 'Player',
              actorType: ACTOR.PLAYER,
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
              ...(effect.ticks
                ? { ticks: effect.ticks.map((tick) => ({ ...tick, atMs: damageAtMs + tick.atMs })) }
                : {})
            };
          }
        )
    }
  ];
}

const INSTRUMENT_ACTIONS: NonNullable<MesmerSkill['sideEffects']> = [
  { on: 'castStart', do: { type: 'mesmer.troubadour.performance-traits' } },
  { on: 'castCommit', do: { type: 'mesmer.troubadour.commit-instrument' } }
];

// Lute starts playing when its waves launch, so its first hit already benefits from the playing bonuses.
const LUTE_ACTIONS: NonNullable<MesmerSkill['sideEffects']> = [
  { on: 'castStart', do: { type: 'mesmer.troubadour.performance-traits' } },
  { on: 'castStart', do: { type: 'mesmer.troubadour.schedule-lute-playing' } }
];

export const MESMER_TROUBADOUR_SKILL_MECHANICS: Readonly<
  Record<SkillId, Partial<MesmerSkill> & { readonly instrument?: MesmerInstrument }>
> = Object.freeze({
  [ID.LIVELY_LUTE]: {
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
    castTimeMs: 560,
    // The performance launches before recovery ends; later cancellation preserves its notes and waves.
    interruptCommitMs: 360,
    effects: [],
    effectVariants: instrumentEffects('mesmer.troubadour.lively-lute'),
    sideEffects: LUTE_ACTIONS
  },
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: {
    tale: {
      name: 'Tale of the Honorable Rogue',
      profileId: 'mesmer.troubadour.tale-honorable-rogue',
      instrument: 'Drum',
      resourceGain: 1,
      effects: [{ name: boonKey(BOON.AEGIS), type: 'boon', boon: BOON.AEGIS, duration: 4, stacks: 1 }]
    },
    // The instant tale refunds endurance at commitment through the shared capped pool.
    resourceGain: 50,
    rechargeAnchor: 'castStart',
    cooldown: 4,
    ammo: 2,
    ammoRecharge: 25,
    ammoCastLockout: 4,
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      ...TROUBADOUR_TALE_ACTIONS,
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ]
  },
  [ID.TALE_OF_THE_SECOND_SCION]: {
    tale: {
      name: 'Tale of the Second Scion',
      profileId: 'mesmer.troubadour.tale-second-scion',
      minimumInstruments: 2,
      resourceGain: 1,
      effects: []
    },
    // Commit the tale's rewards after its 520 ms base cast.
    castTimeMs: 520,
    effects: [],
    sideEffects: TROUBADOUR_TALE_ACTIONS
  },
  [ID.FLUSTERING_FLUTE]: {
    instrument: {
      slot: 2,
      instrument: 'Flute',
      coefficient: 1,
      hits: 1,
      damageAtMs: 360,
      conditions: [{ type: 'condition', condition: CONDITION.CONFUSION, duration: 4, stacks: 3 }]
    },
    castTimeMs: 560,
    effects: [
      // Performance and afterimage impacts materialize the same authored control.
      {
        type: 'control',
        source: 'Player',
        controlKind: CONTROL.DAZE,
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // Flute uses the specialization's Cry of Pain bonuses on its native confusion.
    effectVariants: instrumentEffects(
      'mesmer.troubadour.flustering-flute',
      'mesmer.troubadour.flustering-flute-cry-of-pain'
    ),
    sideEffects: INSTRUMENT_ACTIONS
  },
  [ID.TALE_OF_THE_SOULKEEPER]: {
    tale: {
      name: 'Tale of the Soulkeeper',
      profileId: 'mesmer.troubadour.tale-soulkeeper',
      instrument: 'Lute',
      resourceGain: 2,
      effects: [
        { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 15, stacks: 10 },
        { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, duration: 10, stacks: 1 },
        { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 4, stacks: 1 }
      ]
    },
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: [],
    sideEffects: TROUBADOUR_TALE_ACTIONS
  },
  [ID.CRESCENDO]: {
    // Schedule now, but select active instruments at impact rather than acceptance.
    crescendoProfileId: 'mesmer.troubadour.crescendo',
    damageAtMs: 840,
    castTimeMs: 1000,
    effects: [],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.troubadour.schedule-crescendo' } }]
  },
  [ID.HARMONIOUS_HARP]: {
    // The damageless pulse reaches nearby foes at the shortest valid performance, where hit traits proc.
    instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0, damageAtMs: 360 },
    // Harp packets remain valid independently when the channel is interrupted.
    castTimeMs: 2000,
    // Default to a 480ms channel stop while allowing manually shortened 360ms performances.
    defaultInterruptMs: 480,
    interruptMode: 'per-packet',
    effects: [],
    effectVariants: instrumentEffects('mesmer.troubadour.harmonious-harp'),
    sideEffects: [
      ...INSTRUMENT_ACTIONS,
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'emitProfile',
          profileId: 'mesmer.troubadour.instruments',
          effects: (effect) => effect.type === 'buff' && effect.name === 'distortion',
          attribution: { source: 'Player', sourceId: ID.HARMONIOUS_HARP, actorType: ACTOR.PLAYER }
        }
      }
    ]
  },
  [ID.TALE_OF_THE_AUGUST_QUEEN]: {
    // Commit the tale's rewards after its 840 ms base cast.
    castTimeMs: 840,
    // The committed tale grants defensive effects without performing any instrument attacks.
    effects: [
      {
        type: 'aura',
        name: AURA.CHAOS,
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        aura: AURA.CHAOS,
        duration: 6
      },
      {
        type: 'buff',
        name: 'Distortion',
        kind: 'distortion',
        duration: 2,
        stacks: 1,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    sideEffects: [
      ...TROUBADOUR_TALE_ACTIONS,
      { on: 'castCommit', do: { type: 'mesmer.troubadour.play-all-instruments' } }
    ]
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
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [360, 1360, 2360, 3360].map((atMs) => ({ atMs, coefficient: 1 })),
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [360, 1360, 2360, 3360].map((atMs) => ({ atMs, condition: CONDITION.TORMENT, duration: 8, stacks: 1 }))
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: CONDITION.WEAKNESS, stacks: 1, duration: 5 }]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 1360, condition: CONDITION.VULNERABILITY, stacks: 10, duration: 4 }]
      },
      {
        type: 'control',
        atMs: 3360
      }
    ]),
    sideEffects: TROUBADOUR_TALE_ACTIONS
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    // Both Harp variants pulse nearby foes at the shortest valid performance.
    instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0, damageAtMs: 360 },
    // Both Harp variants preserve packets independently when interrupted.
    castTimeMs: 2000,
    // Match the default stop without restricting the alternate Harp's shorter valid performances.
    defaultInterruptMs: 480,
    interruptMode: 'per-packet',
    effects: [],
    effectVariants: instrumentEffects('mesmer.troubadour.harmonious-harp-alternate'),
    sideEffects: [
      ...INSTRUMENT_ACTIONS,
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'emitProfile',
          profileId: 'mesmer.troubadour.instruments',
          effects: (effect) => effect.type === 'buff' && effect.name === 'distortion',
          attribution: { source: 'Player', sourceId: ID.HARMONIOUS_HARP_ALTERNATE, actorType: ACTOR.PLAYER }
        }
      }
    ]
  },
  [ID.DEAFENING_DRUM]: {
    instrument: {
      slot: 3,
      instrument: 'Drum',
      coefficient: 2,
      hits: 1,
      damageAtMs: 520
    },
    castTimeMs: 680,
    interruptCommitMs: 560,
    effects: [
      // Performance and afterimage impacts materialize the same authored control.
      {
        type: 'control',
        source: 'Player',
        controlKind: CONTROL.STUN,
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    effectVariants: instrumentEffects('mesmer.troubadour.deafening-drum'),
    sideEffects: INSTRUMENT_ACTIONS
  },
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: {
    tale: {
      name: 'Tale of the Valiant Marshal',
      profileId: 'mesmer.troubadour.tale-valiant-marshal',
      instrument: 'Harp',
      resourceGain: 1,
      effects: [
        { name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, duration: 4, stacks: 5 },
        { name: boonKey(BOON.RESISTANCE), type: 'boon', boon: BOON.RESISTANCE, duration: 3, stacks: 1 }
      ]
    },
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: [],
    sideEffects: TROUBADOUR_TALE_ACTIONS
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
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
    castTimeMs: 560,
    // Both Lute variants share the same performance commit point.
    interruptCommitMs: 360,
    effects: [],
    effectVariants: instrumentEffects('mesmer.troubadour.lively-lute-alternate'),
    sideEffects: LUTE_ACTIONS
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

export const MESMER_TROUBADOUR_EXTRA_SKILLS: readonly MesmerSkill[] = Object.freeze([
  createDodgeSkill({
    description: 'Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.',
    specialization: 'Troubadour',
    castTimeMs: 0,
    cost: { resource: 'endurance', amount: ENDURANCE.dodgeCost, spendOn: 'castCommit' },
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
  const tale = skill.tale;
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
