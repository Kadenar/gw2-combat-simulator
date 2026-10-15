import { outsideScopeTooltip, traitTooltip, type ProfessionTooltips } from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe inventions tooltips from the selected balance data. */
export const engineerInventionsTooltips = {
  [TRAIT.CLEANSING_SYNERGY]: outsideScopeTooltip,
  [TRAIT.RECONSTRUCTION_ENCLOSURE]: outsideScopeTooltip,
  [TRAIT.ENERGY_AMPLIFIER]: traitTooltip('Regeneration grants power and healing power.', [
    ['attributeBonus', 'Each attribute with regeneration']
  ]),
  [TRAIT.OVER_SHIELD]: outsideScopeTooltip,
  [TRAIT.AUTOMATED_MEDICAL_RESPONSE]: outsideScopeTooltip,
  [TRAIT.SAPPING_DEVICE]: outsideScopeTooltip,
  [TRAIT.EXPERIMENTAL_TURRETS]: outsideScopeTooltip,
  [TRAIT.SOOTHING_DETONATION]: outsideScopeTooltip,
  [TRAIT.MECHA_LEGS]: outsideScopeTooltip,
  [TRAIT.ANTICORROSION_PLATING]: outsideScopeTooltip,
  [TRAIT.BUNKER_DOWN]: outsideScopeTooltip,
  [TRAIT.MEDICAL_DISPERSION_FIELD]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
