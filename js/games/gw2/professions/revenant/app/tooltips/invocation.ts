import {
  fromProfile,
  outsideScopeTooltip,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { variantEffects } from '#gw2/professions/revenant/app/tooltips/shared.js';

/** Describe invocation tooltips from the selected balance data. */
export const revenantInvocationTooltips = {
  [TRAIT.INVOKERS_RAGE]: traitTooltip('Invoking a legend grants fury.'),
  [TRAIT.FEROCIOUS_AGGRESSION]: traitTooltip(
    'Player-owned strike, condition, and life-steal damage increases while you have fury.',
    [['damageIncrease', 'Damage with fury', tooltipPercent]]
  ),
  [TRAIT.CONTAINED_TEMPER]: outsideScopeTooltip,
  [TRAIT.CLEANSING_CHANNEL]: outsideScopeTooltip,
  [TRAIT.RISING_TIDE]: traitTooltip(
    'Player-owned strikes deal increased damage at the full health used by combat simulations.',
    [fromProfile(TRAIT.RISING_TIDE, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.GLARING_RESOLVE]: outsideScopeTooltip,
  [TRAIT.SPIRIT_BOON]: (balanceContext, entity) => {
    const effects = variantEffects(tooltipProfile(balanceContext, entity.id).effects);
    return {
      ...effects,
      description:
        "Invoking a legend grants its corresponding boon. Entity invocation uses the paired core legend's boon."
    };
  },
  [TRAIT.RAPID_FLOW]: outsideScopeTooltip,
  [TRAIT.INCENSED_RESPONSE]: traitTooltip('Receiving a player-owned fury application grants might.'),
  [TRAIT.SONG_OF_THE_MISTS]: (balanceContext) => {
    const alliance = balanceContext.catalog.skillsById.get(ID.CALL_OF_THE_ALLIANCE)!;
    // Elite legends own separate invocation skills; include their resource grants as well as attack packets.
    return {
      facts: [],
      description:
        "Invoking a legend triggers its corresponding effect. Entity invocation uses the paired core legend's effect.",
      factTabs: [
        // Invocation tooltips read the same patchable call skills as the runtime.
        ...(
          [
            ['Assassin', ID.CALL_OF_THE_ASSASSIN],
            ['Dwarf', ID.CALL_OF_THE_DWARF],
            ['Demon', ID.CALL_OF_THE_DEMON]
          ] as const
        ).map(([label, id]) => ({
          label,
          facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(id)!.effects).facts
        })),
        {
          label: 'Centaur',
          facts: [{ name: 'Call of the Centaur', detail: 'Healing is outside simulation scope.' }]
        },
        {
          label: 'Dragon',
          facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.CALL_OF_THE_DRAGON)!.effects).facts
        },
        {
          label: 'Alliance',
          facts: [
            ...simulationEffectFacts(alliance.effects).facts,
            { name: 'Endurance gained', detail: tooltipDecimal(tooltipNumber(alliance, 'resourceGain')) }
          ]
        },
        {
          label: 'Renegade',
          facts: [
            ...simulationEffectFacts(balanceContext.catalog.skillsById.get(ID.CALL_OF_THE_RENEGADE)!.effects).facts,
            // The invocation hook grants two stacks; their durations come from the selected Fervor profiles.
            ...[RENEGADE.kallasFervor, RENEGADE.kallasFervorLastingLegacy].flatMap(
              (id) =>
                simulationEffectFacts(
                  tooltipProfile(balanceContext, id).effects?.map((effect) => ({ ...effect, stacks: 2 })),
                  id === RENEGADE.kallasFervor ? 'base duration' : 'with Lasting Legacy instead'
                ).facts
            )
          ]
        },
        {
          label: 'Entity',
          facts: [
            {
              name: 'Paired legend',
              detail: 'Uses the Assassin, Demon, Dwarf, or Centaur effect matching your other equipped legend.'
            }
          ]
        }
      ]
    };
  },
  [TRAIT.CHARGED_MISTS]: traitTooltip(
    'Swapping legends below the energy threshold resets energy to the increased starting amount.',
    [
      ['threshold', 'Energy threshold'],
      ['resourceGain', 'Energy after the swap']
    ]
  ),
  // Show the fixed bonuses applied by Revenant's runtime and build attribute rules.
  [TRAIT.ROILING_MISTS]: traitTooltip('Fury grants additional critical-strike chance.', [
    ['criticalChance', 'Additional critical-strike chance with Fury', tooltipPercent]
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
