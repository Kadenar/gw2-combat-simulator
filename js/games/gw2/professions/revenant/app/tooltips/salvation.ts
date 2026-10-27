import {
  outsideScopeTooltip,
  simulationEffectFacts,
  tooltipPercent,
  tooltipProfile,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Describe salvation tooltips from the selected balance data. */
export const revenantSalvationTooltips = {
  [TRAIT.HEALERS_GIFT]: outsideScopeTooltip,
  [TRAIT.LIFE_ATTUNEMENT]: traitTooltip('Gain healing power and convert eligible healing power to concentration.', [
    ['attributeBonuses.healingPower', 'Healing power'],
    ['attributeConversion', 'Eligible healing power converted to concentration', tooltipPercent]
  ]),
  // Show the supported skill-specific boons while explicitly excluding healing effectiveness.
  [TRAIT.SERENE_REJUVENATION]: (balanceContext, entity) => ({
    description:
      'Legendary Centaur skills grant boons to nearby allies, including yourself. Increased healing effectiveness is outside simulation scope.',
    facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
      (effect) =>
        simulationEffectFacts(
          [effect],
          `on ${balanceContext.catalog.skillsById.get(Number(effect.metadata?.trigger))!.name}`
        ).facts
    )
  }),
  [TRAIT.INVOKING_HARMONY]: outsideScopeTooltip,
  [TRAIT.BLINDING_TRUTHS]: outsideScopeTooltip,
  [TRAIT.ELUDING_NULLIFICATION]: outsideScopeTooltip,
  [TRAIT.WORDS_OF_CENSURE]: outsideScopeTooltip,
  [TRAIT.RESILIENT_SPIRIT]: outsideScopeTooltip,
  [TRAIT.FORTIFIED_BLESSING]: outsideScopeTooltip,
  [TRAIT.GENEROUS_ABUNDANCE]: outsideScopeTooltip,
  [TRAIT.UNYIELDING_DEVOTION]: outsideScopeTooltip,
  [TRAIT.INVIGORATING_DISMISSAL]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
