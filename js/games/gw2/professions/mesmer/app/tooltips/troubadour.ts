import { RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  fromProfile,
  fromModifier,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  skillFact,
  tooltipPercent,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_TROUBADOUR_INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';

/** Describe the selected skills and their intrinsic trait policy without a second payload catalog. */
export const troubadourTooltips = {
  skills: {
    ...Object.fromEntries(
      Object.keys(MESMER_TROUBADOUR_INSTRUMENTS).map((id) => [
        Number(id),
        (context, entity) => ({
          description:
            "Perform this instrument's attack, then spend notes to keep it playing. Additional notes extend its duration. Different instruments overlap; performing the same instrument replaces its previous window. Instrument and note-spending traits apply.",
          facts: [
            ...simulationEffectFacts(requireSkillFromContext(context, entity.id).effects).facts,
            profileFact(context, TRAIT.WANDERING_MINSTREL, 'baseDuration', 'Base instrument duration', tooltipSeconds),
            profileFact(
              context,
              TRAIT.WANDERING_MINSTREL,
              'durationPerTier',
              'Additional duration per note',
              tooltipSeconds
            ),
            ...([ID.HARMONIOUS_HARP, ID.HARMONIOUS_HARP_ALTERNATE].some((id) => id === entity.id)
              ? simulationEffectFacts(
                  requireSkillAction(requireSkillFromContext(context, entity.id), 'distortion').effects
                ).facts
              : [])
          ]
        })
      ])
    ),
    [ID.CRESCENDO]: (context) => ({
      description:
        'Strike with increased damage for each instrument still active at impact. Fragmentation increases that bonus. Altered Chord, Life of the Party, and Fortissimo can add rewards.',
      facts: [
        ...simulationEffectFacts(
          requireSkillAction(requireSkillFromContext(context, ID.CRESCENDO), 'crescendo').effects,
          'before active-instrument bonus'
        ).facts,
        skillFact(
          context,
          ID.CRESCENDO,
          'damageIncreasePerInstrument',
          'Strike damage per active instrument',
          tooltipPercent
        )
      ]
    }),
    [SHARED_SKILL_IDS.DODGE]: skillTooltip('Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.'),
    ...Object.fromEntries(
      [
        [ID.TALE_OF_THE_HONORABLE_ROGUE, 'Drum'],
        [ID.TALE_OF_THE_SOULKEEPER, 'Lute'],
        [ID.TALE_OF_THE_VALIANT_MARSHAL, 'Harp']
      ].map(([id, instrument]) => [
        id,
        skillTooltip(
          `Tell a tale and grant its boons to your party. If ${instrument} was playing at acceptance, gain notes. Raconteur adds protection.` +
            (id === ID.TALE_OF_THE_HONORABLE_ROGUE ? ' Restore 50 endurance.' : ''),
          (context) => [
            ...simulationEffectFacts(
              requireSkillAction(requireSkillFromContext(context, id), 'tale').effects.map((effect) => ({
                ...effect,
                audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
              }))
            ).facts,
            skillFact(context, id, 'noteGain', 'Notes with matching instrument')
          ]
        )
      ])
    ),
    [ID.TALE_OF_THE_TORTURED_MASTERMIND]: skillTooltip(
      'Tell a tale and strike your target. Gain a note if Flute was playing at acceptance. Raconteur grants party protection.'
    ),
    [ID.TALE_OF_THE_SECOND_SCION]: skillTooltip(
      'Tell a tale. Gain notes if at least two instruments were playing at acceptance. Raconteur grants party protection.',
      (context) => [skillFact(context, ID.TALE_OF_THE_SECOND_SCION, 'noteGain', 'Notes with two or more instruments')]
    ),
    [ID.TALE_OF_THE_AUGUST_QUEEN]: skillTooltip(
      'Grant Chaos Aura and Distortion, and start every instrument playing. Duration increases with the number already playing at commitment. Raconteur grants party protection.',
      (context) => [
        skillFact(context, ID.TALE_OF_THE_AUGUST_QUEEN, 'baseDuration', 'Base instrument duration', tooltipSeconds),
        skillFact(
          context,
          ID.TALE_OF_THE_AUGUST_QUEEN,
          'durationPerTier',
          'Duration per playing instrument',
          tooltipSeconds
        )
      ]
    )
  },
  traits: {
    [TRAIT.WANDERING_MINSTREL]: traitTooltip(
      'Unlock Troubadour, tales, notes, and instruments. Instruments replace shatters and consume notes to extend their playing time.'
    ),
    [TRAIT.SYMPHONIC_RESONANCE]: traitTooltip(
      'Active instruments grant their corresponding passive bonuses. Lute increases personal damage; Flute increases endurance regeneration.',
      [
        fromModifier('mesmer.lute', 'amount', 'Personal strike and condition damage with Lute'),
        ['enduranceRegenerationMultiplier', 'Endurance regeneration with Flute', tooltipFactorChange]
      ]
    ),
    [TRAIT.HARMONIZE]: traitTooltip('Successfully summoning a phantasm grants a note.', [
      ['resourceGain', 'Notes gained']
    ]),
    [TRAIT.MAYHEM]: traitTooltip(
      "Flustering Flute attacks apply torment. Dodging reduces Flustering Flute's active recharge.",
      [['rechargeReduction', 'Recharge removed', tooltipSeconds]]
    ),
    [TRAIT.RACONTEUR]: traitTooltip('Resolving a tale grants protection.'),
    [TRAIT.SYNCOPATE]: traitTooltip(
      'Control effects and Method of Madness trigger an immediate strike. Deafening Drum also emits a delayed strike and daze.',
      [['initialDelay', 'Drum wave delay', tooltipSeconds]]
    ),
    [TRAIT.SHREDDING]: traitTooltip(
      'Lively Lute gains an additional strike. While Lute is playing, gain additional personal strike and condition damage.',
      [
        fromProfile(TRAIT.SHREDDING, 'damageIncrease', 'Additional strike damage with Lute', tooltipPercent),
        fromProfile(TRAIT.SHREDDING, 'conditionDamageIncrease', 'Additional condition damage with Lute', tooltipPercent)
      ],
      'additional Lute strike'
    ),
    [TRAIT.LIFE_OF_THE_PARTY]: traitTooltip(
      'Lively Lute grants quickness and might to the party. Crescendo grants its separate quickness, might, and fury applications.',
      () => [],
      RECIPIENT.PARTY
    ),
    [TRAIT.LOVE_SONG]: outsideScopeTooltip,
    [TRAIT.FORTISSIMO]: traitTooltip(
      'Each active instrument increases eligible attributes. Crescendo subsequently generates notes at regular intervals.',
      [
        ['attributeConversion', 'Attribute increase per active instrument', tooltipPercent],
        ['maximumStacks', 'Note-generation pulses'],
        ['pulseInterval', 'Pulse interval', tooltipSeconds],
        ['resourceGain', 'Notes per pulse']
      ]
    ),
    [TRAIT.CALL_AND_RESPONSE]: traitTooltip(
      'Spending exactly the required notes on an instrument causes an afterimage to repeat its attack after a delay.',
      [
        ['threshold', 'Notes required'],
        ['initialDelay', 'Repeat delay', tooltipSeconds]
      ]
    ),
    [TRAIT.ALTERED_CHORD]: traitTooltip(
      'Spending notes on an instrument reduces Crescendo recharge. Crescendo grants a strike-damage bonus after Lute, applies confusion after Flute, or applies a control effect after Drum.',
      [
        ['rechargeReduction', 'Crescendo recharge removed', tooltipSeconds],
        fromProfile(TRAIT.ALTERED_CHORD, 'damageIncrease', 'Strike damage after Lute', tooltipPercent),
        ['duration', 'Lute bonus duration', tooltipSeconds]
      ],
      'Crescendo after Flute'
    )
  }
} satisfies ProfessionTooltips;
