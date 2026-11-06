/**
 * Owns Troubadour instrument, Tale, and simulator-action catalog data.
 * Instrument and Tale runtime behavior lives under `mechanics/`.
 */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, AURA, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { createDodgeSkill } from '#gw2/platform/skills/shared-actions.js';
import type { SkillDefinition, SkillId } from '#gw2/platform/skills/types.js';
import { cryOfPainConfusion } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { instrumentSkill } from '#gw2/professions/mesmer/specializations/troubadour/skills/instrument.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

// Tales capture eligibility at acceptance and grant their intrinsic rewards at commitment.
const TROUBADOUR_TALE_ACTIONS: NonNullable<MesmerSkill['sideEffects']> = [
  { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
  { on: 'castCommit', do: { id: 'tale', type: 'mesmer.troubadour.resolve-tale', effects: [] } }
];

/** Cry of Pain augments only the player's Flute performance; afterimages keep the native conditions. */
function traitedInstrumentConditions(
  source: BalanceProfileSource,
  runtime: unknown,
  effects: readonly SkillEffect[],
  skill: MesmerSkill
): readonly SkillEffect[] {
  if (skill.id !== ID.FLUSTERING_FLUTE) return effects;

  return effects.map((effect) =>
    effect.type === 'condition' && effect.condition === CONDITION.CONFUSION
      ? cryOfPainConfusion(source, runtime, effect, skill)!
      : effect
  );
}

/** Player performances materialize the same patchable attacks as afterimages on an explicit cast-start clock. */
function instrumentEffects(): NonNullable<MesmerSkill['effectVariants']> {
  return [
    {
      when: () => true,
      transform: (runtime, cast, effects) => {
        // Performances are Mesmer skills; Mesmer narrows skill ids, so the shared cast skill is asserted once here.
        const skill = cast.skill as MesmerSkill;
        const instrument = skill.instrument as MesmerInstrument;
        return traitedInstrumentConditions(runtime.helpers, runtime, effects, skill).map((effect): SkillEffect => {
          const damageAtMs = instrument.damageAtMs ?? 0;
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
            persistsAfterInterrupt: Boolean(instrument.persistsAfterInterrupt),
            ...(effect.ticks ? { ticks: effect.ticks.map((tick) => ({ ...tick, atMs: damageAtMs + tick.atMs })) } : {})
          };
        });
      }
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

const MESMER_TROUBADOUR_SKILL_MECHANICS: Readonly<
  Record<SkillId, SkillDefinition<MesmerSkill> & { readonly instrument?: MesmerInstrument }>
> = {
  [ID.LIVELY_LUTE]: {
    name: 'Lively Lute',
    icon: 'https://render.guildwars2.com/file/4CAA3750145A55B7E73D5EB9917590EC45657BE7/3680159.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 12,
    ...instrumentSkill({
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
      effectVariants: instrumentEffects(),
      sideEffects: LUTE_ACTIONS
    })
  },
  [ID.TALE_OF_THE_HONORABLE_ROGUE]: {
    name: 'Tale of the Honorable Rogue',
    icon: 'https://render.guildwars2.com/file/37EF1C69AC3D935333FCD8FC637729CEBE2A460E/3680165.png',
    type: 'Utility',
    slot: 'Utility',
    tale: { name: 'Tale of the Honorable Rogue', instrument: 'Drum' },
    noteGain: 1,
    // The instant tale refunds endurance at commitment through the shared capped pool.
    resourceGain: 50,
    rechargeAnchor: 'castStart',
    cooldown: 25,
    ammo: 2,

    ammoCastLockout: 4,
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
      {
        on: 'castCommit',
        do: {
          id: 'tale',
          type: 'mesmer.troubadour.resolve-tale',
          effects: [{ name: boonKey(BOON.AEGIS), type: 'boon', boon: BOON.AEGIS, duration: 4, stacks: 1 }]
        }
      },
      { on: 'castCommit', do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } } }
    ]
  },
  [ID.TALE_OF_THE_SECOND_SCION]: {
    name: 'Tale of the Second Scion',
    icon: 'https://render.guildwars2.com/file/F12BF59E070FB12D2EAAA209596C52C4D76C4E97/3680158.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 15,
    tale: { name: 'Tale of the Second Scion', minimumInstruments: 2 },
    noteGain: 1,
    // Commit the tale's rewards after its 520 ms base cast.
    castTimeMs: 520,
    effects: [],
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
      { on: 'castCommit', do: { id: 'tale', type: 'mesmer.troubadour.resolve-tale', effects: [] } }
    ]
  },
  [ID.FLUSTERING_FLUTE]: {
    name: 'Flustering Flute',
    icon: 'https://render.guildwars2.com/file/CFE30B5052A2AA67D9A8AE5FC1FBA0A56C64584C/3680160.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    ...instrumentSkill({
      cryOfPainAdditionalStacks: 2,
      cryOfPainDurationMultiplier: 0.5,
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
      effectVariants: instrumentEffects(),
      sideEffects: INSTRUMENT_ACTIONS
    })
  },
  [ID.TALE_OF_THE_SOULKEEPER]: {
    name: 'Tale of the Soulkeeper',
    icon: 'https://render.guildwars2.com/file/AC9DC59D1CEF42DFD47CED6CE429041C7FADBBE7/3680164.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    tale: { name: 'Tale of the Soulkeeper', instrument: 'Lute' },
    noteGain: 2,
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
      {
        on: 'castCommit',
        do: {
          id: 'tale',
          type: 'mesmer.troubadour.resolve-tale',
          effects: [
            { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 15, stacks: 10 },
            { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, duration: 10, stacks: 1 },
            { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 4, stacks: 1 }
          ]
        }
      }
    ]
  },
  [ID.CRESCENDO]: {
    name: 'Crescendo',
    icon: 'https://render.guildwars2.com/file/935C32505D1F4DB7D9739C2C4B4137D4346709A4/3680163.png',
    type: 'Profession',
    slot: 'Profession_5',
    cooldown: 35,
    // Schedule now, but select active instruments at impact rather than acceptance.
    damageIncreasePerInstrument: 0.25,
    damageAtMs: 840,
    castTimeMs: 1000,
    // Captured instrument state strengthens only this skill's player strike without altering its coefficient.
    modifiers: [
      {
        id: 'mesmer.crescendo-instruments',
        label: 'Crescendo',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        order: 1000,
        factor: (context) =>
          1 + Number(context.event?.crescendoInstrumentCount) * Number(context.event?.crescendoEffectiveness),
        when: (context) => isGw2PlayerActorEvent(context.event) && context.event?.crescendoInstrumentCount != null
      }
    ],
    effects: [],
    sideEffects: [
      {
        on: 'castStart',
        do: {
          id: 'crescendo',
          type: 'mesmer.troubadour.schedule-crescendo',
          effects: [{ name: 'Strike', type: 'strike', coefficient: 2.25, hits: 1 }]
        }
      }
    ]
  },
  [ID.HARMONIOUS_HARP]: {
    name: 'Harmonious Harp',
    icon: 'https://render.guildwars2.com/file/C1BCF465DE1DAB00E00B0F1494ABDB2D7F57BECA/3680162.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 25,
    ...instrumentSkill({
      // The damageless pulse reaches nearby foes at the shortest valid performance, where hit traits proc.
      instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0, damageAtMs: 360 },
      // Harp packets remain valid independently when the channel is interrupted.
      castTimeMs: 2000,
      // Default to a 480ms channel stop while allowing manually shortened 360ms performances.
      defaultInterruptMs: 480,
      interruptMode: 'per-packet',
      effects: [],
      effectVariants: instrumentEffects(),
      sideEffects: [
        ...INSTRUMENT_ACTIONS,
        {
          on: 'castStart',
          when: (_runtime, cast) => !cast.cancelledBeforeCommit,
          do: {
            id: 'distortion',
            type: 'mesmer.troubadour.harp-distortion',
            effects: [{ name: 'distortion', type: 'buff', kind: 'distortion', duration: 2, stacks: 1 }]
          }
        }
      ]
    })
  },
  [ID.TALE_OF_THE_AUGUST_QUEEN]: {
    name: 'Tale of the August Queen',
    icon: 'https://render.guildwars2.com/file/3FE0BC0317E63419FBCCC374A0D0A358E3A225F7/3680157.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 75,
    baseDuration: 3,
    durationPerTier: 3,
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
    name: 'Tale of the Tortured Mastermind',
    icon: 'https://render.guildwars2.com/file/64FFFDF0DB06E31493673D7313305536B7AAA53D/3680167.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 20,
    tale: { name: 'Tale of the Tortured Mastermind', instrument: 'Flute' },
    noteGain: 1,
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
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
      { on: 'castCommit', do: { id: 'tale', type: 'mesmer.troubadour.resolve-tale', effects: [] } }
    ]
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    name: 'Harmonious Harp',
    icon: 'https://render.guildwars2.com/file/C1BCF465DE1DAB00E00B0F1494ABDB2D7F57BECA/3680162.png',
    type: 'Profession',
    slot: 'Profession_4',
    cooldown: 25,
    ...instrumentSkill({
      // Both Harp variants pulse nearby foes at the shortest valid performance.
      instrument: { slot: 4, instrument: 'Harp', coefficient: 0, hits: 0, damageAtMs: 360 },
      // Both Harp variants preserve packets independently when interrupted.
      castTimeMs: 2000,
      // Match the default stop without restricting the alternate Harp's shorter valid performances.
      defaultInterruptMs: 480,
      interruptMode: 'per-packet',
      effects: [],
      effectVariants: instrumentEffects(),
      sideEffects: [
        ...INSTRUMENT_ACTIONS,
        {
          on: 'castStart',
          when: (_runtime, cast) => !cast.cancelledBeforeCommit,
          do: {
            id: 'distortion',
            type: 'mesmer.troubadour.harp-distortion',
            effects: [{ name: 'distortion', type: 'buff', kind: 'distortion', duration: 2, stacks: 1 }]
          }
        }
      ]
    })
  },
  [ID.DEAFENING_DRUM]: {
    name: 'Deafening Drum',
    icon: 'https://render.guildwars2.com/file/E061ECE20A34DC281C0E3EB8FB90094549E87941/3680161.png',
    type: 'Profession',
    slot: 'Profession_3',
    cooldown: 25,
    ...instrumentSkill({
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
      effectVariants: instrumentEffects(),
      sideEffects: INSTRUMENT_ACTIONS
    })
  },
  [ID.TALE_OF_THE_VALIANT_MARSHAL]: {
    name: 'Tale of the Valiant Marshal',
    icon: 'https://render.guildwars2.com/file/C0BF1CA6F342F135C71E97D827ECCC776D0E7429/3680166.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 30,
    tale: { name: 'Tale of the Valiant Marshal', instrument: 'Harp' },
    noteGain: 1,
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.troubadour.prepare-tale' } },
      {
        on: 'castCommit',
        do: {
          id: 'tale',
          type: 'mesmer.troubadour.resolve-tale',
          effects: [
            { name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, duration: 4, stacks: 5 },
            { name: boonKey(BOON.RESISTANCE), type: 'boon', boon: BOON.RESISTANCE, duration: 3, stacks: 1 }
          ]
        }
      }
    ]
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    name: 'Lively Lute',
    icon: 'https://render.guildwars2.com/file/4CAA3750145A55B7E73D5EB9917590EC45657BE7/3680159.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 12,
    ammoCastLockout: 1,
    ammo: 2,

    ...instrumentSkill({
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
      effectVariants: instrumentEffects(),
      sideEffects: LUTE_ACTIONS
    })
  }
};

// Derive runtime and balance-profile inputs from the skill records so instrument behavior has one authoring site.
export const MESMER_TROUBADOUR_INSTRUMENTS: Readonly<Record<number, MesmerInstrument>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_TROUBADOUR_SKILL_MECHANICS).flatMap(([skillId, skill]) =>
      skill.instrument ? [[Number(skillId), skill.instrument]] : []
    )
  )
);

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const MESMER_TROUBADOUR_SKILLS: readonly MesmerSkill[] = Object.freeze([
  ...materializeSkillDefinitions(MESMER_TROUBADOUR_SKILL_MECHANICS),
  createDodgeSkill({
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
