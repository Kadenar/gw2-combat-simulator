import {
  fromProfile,
  fromSkill,
  maximumBonusFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MAX_MIGHT_STACKS } from '#gw2/platform/combat/boons.js';
import { CONDITION } from '#gw2/platform/constants.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

// Round the displayed duration bonus because the base shatter uses a repeating fraction.
const cryOfPainPercent = (bonus: number) => tooltipPercent(bonus, { maximumFractionDigits: 2 });

/** Name the active specialization's skills so slot numbers cannot be mistaken for hit ordering. */
function shatterNames(specialization?: string) {
  switch (specialization) {
    case 'Chronomancer':
      return { power: 'Split Second', confusion: 'Rewinder' };
    case 'Virtuoso':
      return { power: 'Bladesong Harmony', confusion: 'Bladesong Sorrow' };
    case 'Troubadour':
      return { power: 'Lively Lute', confusion: 'Flustering Flute' };
    default:
      return { power: 'Mind Wrack', confusion: 'Cry of Frustration' };
  }
}

/** Describe illusions tooltips from the selected balance data. */
export const mesmerIllusionsTooltips = {
  [TRAIT.CRY_OF_PAIN]: (context, entity, specialization) =>
    traitTooltip(
      `${shatterNames(specialization).confusion} inflicts additional confusion stacks, and its confusion lasts longer.`,
      specialization === 'Troubadour'
        ? [
            fromSkill(ID.FLUSTERING_FLUTE, 'cryOfPainAdditionalStacks', 'Additional confusion stacks'),
            fromSkill(ID.FLUSTERING_FLUTE, 'cryOfPainDurationMultiplier', 'Confusion duration', cryOfPainPercent)
          ]
        : [
            ['additionalStacks', 'Additional confusion stacks'],
            ['durationMultiplier', 'Confusion duration', cryOfPainPercent]
          ]
    )(context, entity),
  [TRAIT.COMPOUNDING_POWER]: (context, entity, specialization) => {
    const gain =
      specialization === 'Virtuoso'
        ? 'stock a blade'
        : specialization === 'Troubadour'
          ? 'gain a note'
          : 'create a clone';
    return traitTooltip(
      `Gain one stack each time you summon a phantasm or ${gain}. Each stack increases your strike and condition damage. Your illusions also benefit from the condition damage bonus.`,
      [
        ['damageIncreasePerStack', 'Strike damage per stack', tooltipPercent],
        ['conditionDamageIncreasePerStack', 'Condition damage per stack', tooltipPercent],
        ['maximumStacks', 'Maximum stacks'],
        ['duration', 'Stack duration', tooltipSeconds]
      ]
    )(context, entity);
  },
  [TRAIT.MASTER_OF_MISDIRECTION]: traitTooltip('Shatters and instrument skills recharge faster.', [
    ['rechargeMultiplier', 'Recharge', tooltipFactorChange]
  ]),
  [TRAIT.SHATTER_STORM]: (context, entity, specialization) =>
    traitTooltip(`${shatterNames(specialization).power} gains ammunition.`, [['maximumStacks', 'Ammunition']])(
      context,
      entity
    ),
  [TRAIT.PERSISTENCE_OF_MEMORY]: outsideScopeTooltip,
  [TRAIT.THE_PLEDGE]: traitTooltip(
    'Your own burning applications from The Prestige and Phantasmal Mage apply additional burning. Phantasm and trait-proc applications do not trigger this.'
  ),
  [TRAIT.ESCAPE_ARTIST]: outsideScopeTooltip,
  // Logs show only some phantasm phases speed up during its Quickness, so the simulator does not model it.
  [TRAIT.PHANTASMAL_HASTE]: outsideScopeTooltip,
  // Clone explosions, bladesong hits, and instrument attacks have different trigger counts.
  [TRAIT.MAIM_THE_DISILLUSIONED]: (context, entity, specialization) =>
    traitTooltip(
      specialization === 'Troubadour'
        ? 'Your instrument attacks and Crescendo inflict torment on each hit. Afterimage attacks do not trigger this trait.'
        : specialization === 'Virtuoso'
          ? 'Each bladesong hit inflicts torment. Using Bladesong Distortion also inflicts torment.'
          : 'Shattering inflicts torment once for you and once per clone shattered. Repeat strikes from the same shatter do not inflict additional torment.',
      [],
      specialization === 'Troubadour'
        ? 'per player hit'
        : specialization === 'Virtuoso'
          ? 'per bladesong hit; once for Bladesong Distortion'
          : 'per shatter source: you or one clone'
    )(context, entity),
  [TRAIT.PHANTASMAL_FORCE]: traitTooltip('Phantasms deal increased strike damage for each active might stack.', [
    fromProfile(TRAIT.PHANTASMAL_FORCE, 'damageIncreasePerStack', 'Phantasm strike damage per might', tooltipPercent),
    maximumBonusFact('damageIncreasePerStack', MAX_MIGHT_STACKS, 'Maximum phantasm strike damage bonus')
  ]),
  [TRAIT.MASTER_OF_FRAGMENTATION]: (balanceContext, entity, specialization) => ({
    description:
      `${shatterNames(specialization).power} gains critical-strike chance. ${shatterNames(specialization).confusion} hits inflict cripple. ` +
      (specialization === 'Chronomancer'
        ? 'Continuum Split lasts longer.'
        : specialization === 'Virtuoso'
          ? 'Bladeturn Requiem strikes one additional time.'
          : specialization === 'Troubadour'
            ? 'Deafening Drum hits inflict weakness. Crescendo gains more damage per active instrument.'
            : ''),
    facts: [
      profileFact(
        balanceContext,
        TRAIT.MASTER_OF_FRAGMENTATION,
        'criticalChance',
        `${shatterNames(specialization).power} critical chance`,
        tooltipPercent
      ),
      ...(specialization === 'Chronomancer'
        ? [
            profileFact(
              balanceContext,
              entity.id,
              'durationExtension',
              'Additional Continuum Split duration',
              tooltipSeconds
            )
          ]
        : []),
      ...(specialization === 'Troubadour'
        ? [
            profileFact(
              balanceContext,
              entity.id,
              'damageIncreasePerStack',
              'Crescendo damage per active instrument',
              tooltipPercent
            )
          ]
        : []),
      // Match the condition rather than its array position so patch removals cannot change the recipient skill.
      ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap((effect) => {
        if (effect.type !== 'condition') return [];

        if (effect.condition === CONDITION.CRIPPLED)
          return simulationEffectFacts([effect], `${shatterNames(specialization).confusion} hit`).facts;

        return specialization === 'Troubadour' && effect.condition === CONDITION.WEAKNESS
          ? simulationEffectFacts([effect], 'Deafening Drum hit').facts
          : [];
      })
    ]
  }),
  // Display the fractional duration bonus as a percentage for the trait tooltip.
  [TRAIT.MALICIOUS_SORCERY]: traitTooltip('Confusion lasts longer.', [
    ['durationMultiplier', 'Confusion duration', tooltipPercent]
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
