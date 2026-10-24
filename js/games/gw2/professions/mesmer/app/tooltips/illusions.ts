import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  profileFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Describe illusions tooltips from the selected balance data. */
export const mesmerIllusionsTooltips = {
  [TRAIT.CRY_OF_PAIN]: traitTooltip(
    "Replace the supported confusion shatter's base confusion application with this stronger application.",
    () => [],
    'replacement per eligible shatter hit'
  ),
  [TRAIT.COMPOUNDING_POWER]: traitTooltip(
    'Creating illusion resources grants temporary stacks that increase your strike and condition damage. Illusion strikes do not inherit the personal strike bonus.',
    [
      fromProfile(TRAIT.COMPOUNDING_POWER, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
      fromProfile(
        TRAIT.COMPOUNDING_POWER,
        'conditionDamageIncreasePerStack',
        'Condition damage per stack',
        tooltipPercent
      ),
      ['maximumStacks', 'Maximum stacks'],
      ['duration', 'Stack duration', tooltipSeconds]
    ]
  ),
  [TRAIT.MASTER_OF_MISDIRECTION]: traitTooltip('Shatters and instrument skills recharge faster.', [
    ['rechargeMultiplier', 'Recharge', tooltipFactorChange]
  ]),
  [TRAIT.SHATTER_STORM]: traitTooltip('The first shatter gains ammunition.', [['maximumStacks', 'Ammunition']]),
  [TRAIT.PERSISTENCE_OF_MEMORY]: outsideScopeTooltip,
  [TRAIT.THE_PLEDGE]: traitTooltip(
    'Your own burning applications from The Prestige and Phantasmal Mage apply additional burning. Phantasm and trait-proc applications do not trigger this.'
  ),
  [TRAIT.ESCAPE_ARTIST]: outsideScopeTooltip,
  [TRAIT.PHANTASMAL_HASTE]: traitTooltip('Phantasms perform their attacks faster.', [
    ['quicknessCastMultiplier', 'Phantasm action speed', (value) => `${tooltipDecimal(value)}×`]
  ]),
  [TRAIT.MAIM_THE_DISILLUSIONED]: traitTooltip(
    'Eligible first-strike shatter packets inflict torment.',
    () => [],
    'per eligible shatter hit'
  ),
  [TRAIT.PHANTASMAL_FORCE]: traitTooltip('Phantasms deal increased strike damage for each active might stack.', [
    fromProfile(TRAIT.PHANTASMAL_FORCE, 'damageIncreasePerStack', 'Phantasm strike damage per might', tooltipPercent)
  ]),
  [TRAIT.MASTER_OF_FRAGMENTATION]: (balanceContext, entity) => ({
    description:
      "Improve native first-shatter critical chance, add cripple to supported second-shatter hits and weakness to Deafening Drum, extend supported defensive shatters, and improve Crescendo's scaling per active instrument.",
    facts: [
      profileFact(
        balanceContext,
        TRAIT.MASTER_OF_FRAGMENTATION,
        'criticalChance',
        'First-shatter critical chance',
        tooltipPercent
      ),
      profileFact(
        balanceContext,
        entity.id,
        'durationExtension',
        'Additional defensive-shatter duration',
        tooltipSeconds
      ),
      profileFact(
        balanceContext,
        entity.id,
        'damageIncreasePerStack',
        'Crescendo damage per active instrument',
        tooltipPercent
      ),
      ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) =>
          simulationEffectFacts([effect], index === 0 ? 'second-shatter hit' : 'Deafening Drum hit').facts
      )
    ]
  }),
  // Display the fractional duration bonus as a percentage for the trait tooltip.
  [TRAIT.MALICIOUS_SORCERY]: traitTooltip('Confusion lasts longer.', [
    ['durationMultiplier', 'Confusion duration', tooltipPercent]
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
