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
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import {
  TROUBADOUR_BALANCE_PROFILE_IDS as TROUBADOUR,
  TROUBADOUR_INSTRUMENT_PROFILE_IDS
} from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';

/** Describe troubadour tooltips from the selected balance data. */
export const troubadourTooltips = {
  skills: {
    ...Object.fromEntries(
      Object.keys(TROUBADOUR_INSTRUMENT_PROFILE_IDS).map((id) => [
        Number(id),
        (balanceContext, entity) => ({
          description:
            "Perform this instrument's attack, then spend your notes to keep the instrument active. Additional notes extend its duration. Different instruments can overlap; a new performance replaces the same instrument's previous window. Instrument and note-spending traits apply.",
          facts: [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, TROUBADOUR_INSTRUMENT_PROFILE_IDS[Number(entity.id)]).effects
            ).facts,
            ...simulationEffectFacts(
              balanceContext.catalog.skillsById.get(entity.id)!.effects?.filter((effect) => effect.type === 'control')
            ).facts,
            profileFact(
              balanceContext,
              TROUBADOUR.instruments,
              'durationMultiplier',
              'Base instrument duration',
              tooltipSeconds
            ),
            profileFact(
              balanceContext,
              TROUBADOUR.instruments,
              'durationPerTier',
              'Additional duration per note',
              tooltipSeconds
            ),
            ...([ID.HARMONIOUS_HARP, ID.HARMONIOUS_HARP_ALTERNATE].some((id) => id === entity.id)
              ? simulationEffectFacts(tooltipProfile(balanceContext, TROUBADOUR.instruments).effects).facts
              : [])
          ]
        })
      ])
    ),
    [ID.CRESCENDO]: (balanceContext) => ({
      description:
        'Strike with increased damage for each instrument still active when the attack lands. Fragmentation increases that bonus. Altered Chord adds an effect from your most recent instrument; Life of the Party grants boons, and Fortissimo generates notes over time.',
      facts: [
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, TROUBADOUR.crescendo).effects,
          'before active-instrument bonus'
        ).facts,
        profileFact(
          balanceContext,
          TROUBADOUR.crescendo,
          'damageIncreasePerStack',
          'Strike damage per active instrument',
          tooltipPercent
        )
      ]
    }),
    [SHARED_SKILL_IDS.DODGE]: skillTooltip('Spend 50 endurance to evade. Mayhem reduces Flustering Flute recharge.'),
    ...Object.fromEntries(
      [
        [ID.TALE_OF_THE_HONORABLE_ROGUE, TROUBADOUR.honorableRogue, 'Drum'],
        [ID.TALE_OF_THE_SOULKEEPER, TROUBADOUR.soulkeeper, 'Lute'],
        [ID.TALE_OF_THE_VALIANT_MARSHAL, TROUBADOUR.valiantMarshal, 'Harp']
      ].map(([id, profileId, instrument]) => [
        id,
        skillTooltip(
          `Tell a tale and grant its boons to your party. If ${instrument} is active when the cast begins, gain notes. Raconteur adds protection.` +
            (id === ID.TALE_OF_THE_HONORABLE_ROGUE ? ' Restore 50 endurance.' : ''),
          (balanceContext) => [
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, profileId).effects?.map((effect) => ({
                ...effect,
                audience: { recipients: 'party', maximumRecipients: 5 }
              }))
            ).facts,
            profileFact(balanceContext, profileId, 'resourceGain', 'Notes with matching instrument')
          ]
        )
      ])
    ),
    [ID.TALE_OF_THE_TORTURED_MASTERMIND]: skillTooltip(
      'Tell a tale and strike your target. Gain a note if Flute was active when the cast began. Raconteur also grants party protection.'
    ),
    ...Object.fromEntries(
      [ID.TALE_OF_THE_SECOND_SCION, ID.TALE_OF_THE_AUGUST_QUEEN].map((id) => [
        id,
        skillTooltip(
          'Tell a tale. Raconteur grants party protection. This tale has no additional instrument-note branch in the simulation.'
        )
      ])
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
      'party'
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
        ['durationMultiplier', 'Lute bonus duration', tooltipSeconds]
      ],
      'Crescendo after Flute'
    )
  }
} satisfies ProfessionTooltips;
