import {
  outsideScopeTooltip,
  tooltipFactorChange,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Describe inspiration tooltips from the selected balance data. */
export const mesmerInspirationTooltips = {
  [TRAIT.MENDERS_PURITY]: outsideScopeTooltip,
  [TRAIT.INSPIRING_DISTORTION]: outsideScopeTooltip,
  [TRAIT.ILLUSIONARY_INSPIRATION]: outsideScopeTooltip,
  [TRAIT.MEDICS_FEEDBACK]: outsideScopeTooltip,
  [TRAIT.RESTORATIVE_MANTRAS]: outsideScopeTooltip,
  [TRAIT.SYMPATHETIC_VISAGE]: traitTooltip(
    'Summoning a phantasm removes conditions from nearby allies. Allied condition removal is outside simulation scope.'
  ),
  [TRAIT.FOCAL_FEEDBACK]: traitTooltip(
    'Focus weapon skills have reduced recharge. Phantasmal Disenchanter transfers removed enemy boons to you; enemy boons are outside simulation scope.',
    [['rechargeMultiplier', 'Focus recharge', tooltipFactorChange]]
  ),
  [TRAIT.EGO_RESTORATION]: traitTooltip(
    'Using a healing skill in combat creates a clone, stocks a blade as Virtuoso, or grants a note as Troubadour.'
  ),
  [TRAIT.TEMPORAL_ENCHANTER]: outsideScopeTooltip,
  [TRAIT.MENTAL_DEFENSE]: outsideScopeTooltip,
  [TRAIT.RESTORATIVE_ILLUSIONS]: outsideScopeTooltip,
  [TRAIT.BLURRED_INSCRIPTIONS]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
