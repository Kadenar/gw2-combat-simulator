import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import {
  outsideScopeTooltip,
  profileFact,
  profileTooltip,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { upkeepTooltip } from '#gw2/professions/revenant/app/tooltips/shared.js';

const facetConsumeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Consume the active facet to perform this skill and stop its energy upkeep. Its cooldown belongs to the parent facet. Draconic Echo can retain the passive after consumption.'
);

/** Describe herald tooltips from the selected balance data. */
export const heraldTooltips = {
  skills: {
    ...Object.fromEntries(
      [ID.FACET_OF_STRENGTH, ID.FACET_OF_ELEMENTS, ID.FACET_OF_LIGHT, ID.FACET_OF_CHAOS, ID.FACET_OF_DARKNESS].map(
        (id) => [id, upkeepTooltip]
      )
    ),
    ...Object.fromEntries(
      [
        ID.GAZE_OF_DARKNESS,
        ID.INFUSE_LIGHT,
        ID.CHAOTIC_RELEASE,
        ID.BURST_OF_STRENGTH,
        ID.TRUE_NATURE_ASSASSIN,
        ID.TRUE_NATURE_DWARF,
        ID.TRUE_NATURE_CENTAUR,
        ID.TRUE_NATURE_DEMON,
        ID.ELEMENTAL_BLAST
      ].map((id) => [id, facetConsumeTooltip])
    ),
    [ID.FACET_OF_NATURE]: skillTooltip(
      'Maintain a passive tied to the active legend. Dragon extends outgoing boon duration beyond its normal cap; Assassin adds life siphons to player strikes. The upkeep persists through legend swaps and exposes the matching True Nature consume. Draconic Echo can retain its passive.',
      (balanceContext) => [
        ...simulationEffectFacts(
          requireSkillAction(balanceContext.catalog.skillsById.get(ID.FACET_OF_NATURE)!, 'assassin-siphon').effects,
          'Assassin: per eligible strike'
        ).facts,
        {
          name: 'Assassin siphon cooldown',
          detail: tooltipSeconds(
            tooltipNumber(balanceContext.catalog.skillsById.get(ID.FACET_OF_NATURE), 'internalCooldown')
          )
        }
      ]
    ),
    [ID.TRUE_NATURE_DRAGON]: (balanceContext, entity) => {
      const extension = balanceContext.catalog.skillsById
        .get(entity.id)!
        .effects?.find((effect) => effect.type === 'custom');
      return {
        description:
          'Consume Facet of Nature to extend existing party boons. The consume ends upkeep and starts the shared facet cooldown; Draconic Echo can retain its passive.',
        facts: [{ name: 'Party boon extension', detail: tooltipSeconds(tooltipNumber(extension?.event, 'duration')) }]
      };
    }
  },
  traits: {
    [TRAIT.CRYSTAL_HARBINGER]: traitTooltip('Unlock the Legendary Dragon stance, facets, and Facet of Nature.'),
    [TRAIT.DRACONIC_FORTITUDE]: outsideScopeTooltip,
    [TRAIT.REINFORCED_POTENCY]: traitTooltip(
      'Gain concentration. Each different boon on you increases player strike damage.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'attributeBonus', 'Concentration', (value) => '+' + tooltipDecimal(value)),
        { name: 'Strike damage per unique boon', detail: tooltipPercent(0.01) }
      ]
    ),
    [TRAIT.ELDERS_RESPITE]: outsideScopeTooltip,
    [TRAIT.CORE_VALUE]: traitTooltip("Facet of Nature's boon-extension effect extends boons further.", [
      ['duration', 'Additional boon extension', tooltipSeconds]
    ]),
    [TRAIT.RISING_MOMENTUM]: outsideScopeTooltip,
    [TRAIT.SHARED_EMPOWERMENT]: profileTooltip(
      'revenant.shared-empowerment',
      'Applying a boon to an ally grants might to the party.',
      [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
    ),
    [TRAIT.SHINING_ASPECTS]: outsideScopeTooltip,
    [TRAIT.HARDENING_PERSISTENCE]: outsideScopeTooltip,
    [TRAIT.ELEVATED_COMPASSION]: profileTooltip(
      'revenant.elevated-compassion',
      'Gain concentration from the common power attribute pool. Maintaining enough aggregate upkeep periodically grants party quickness.',
      [
        ['attributeConversion', 'Power converted to concentration', tooltipPercent],
        ['threshold', 'Required aggregate upkeep'],
        ['cooldown', 'Quickness interval', tooltipSeconds]
      ]
    ),
    [TRAIT.DRACONIC_ECHO]: profileTooltip(
      'revenant.draconic-echo',
      'Consumed facets retain their passive effects temporarily. Strength grants strike damage, Elements grants condition damage, Darkness grants critical chance, and Nature grants boon duration.',
      [
        ['duration', 'Echo duration', tooltipSeconds],
        ['damageIncrease', 'Strength strike damage', tooltipPercent],
        ['conditionDamageIncrease', 'Elements condition damage', tooltipPercent],
        ['criticalChanceBonus', 'Darkness critical chance', tooltipPercent],
        ['boonDurationBonus', 'Nature boon duration', (value) => `${value}%`]
      ]
    ),
    // Count each active upkeep skill, rather than its energy drain, using the runtime's two additive rates.
    [TRAIT.FORCEFUL_PERSISTENCE]: traitTooltip(
      'Each active upkeep skill adds to player strike damage. Facets and other upkeep skills grant different bonuses.',
      [
        ['damageIncreasePerStack', 'Strike damage per active facet', tooltipPercent],
        ['upkeepDamageIncrease', 'Strike damage per other active upkeep skill', tooltipPercent]
      ]
    )
  }
} satisfies ProfessionTooltips;
