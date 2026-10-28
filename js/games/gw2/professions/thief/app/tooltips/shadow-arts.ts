import {
  outsideScopeTooltip,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe shadow arts tooltips from the selected balance data. */
export const thiefShadowArtsTooltips = {
  [TRAIT.MERCIFUL_AMBUSH]: outsideScopeTooltip,
  [TRAIT.MELD_WITH_SHADOWS]: outsideScopeTooltip,
  [TRAIT.SHADOW_SIPHONING]: traitTooltip(
    'Stealth attacks trigger an additional strike that cannot critically strike.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.SHIELDING_RESTORATION]: outsideScopeTooltip,
  [TRAIT.SHADOWS_EMBRACE]: outsideScopeTooltip,
  [TRAIT.HIDDEN_THIEF]: traitTooltip('Stealing inflicts blindness and weakness.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.SHADOW_SAVIOR]: outsideScopeTooltip,
  [TRAIT.LEECHING_VENOMS]: traitTooltip(
    'Entering or breaking stealth grants Spider Venom charges. Your venom applications also siphon life; life siphons bypass armor and cannot critically strike.',
    [
      ['resourceGain', 'Spider Venom charges on breaking stealth'],
      ['maximumStacks', 'Maximum charges'],
      ['duration', 'Charge duration', tooltipSeconds]
    ],
    'life siphon per venom application'
  ),
  [TRAIT.CLOAKED_IN_SHADOW]: traitTooltip(
    'Entering stealth inflicts blindness. Applying blindness triggers a strike that cannot critically strike.'
  ),
  [TRAIT.COVER_OF_SHADOW]: outsideScopeTooltip,
  [TRAIT.SHADOWS_REJUVENATION]: traitTooltip('Entering and breaking stealth restore initiative.', [
    ['entryResourceGain', 'Initiative on entering stealth'],
    ['resourceGain', 'Initiative on breaking stealth']
  ]),
  [TRAIT.RENDING_SHADE]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
