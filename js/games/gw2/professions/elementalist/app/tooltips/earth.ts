import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { percentagePoints } from '#gw2/professions/elementalist/app/tooltips/shared.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Describe earth tooltips from the selected balance data. */
export const elementalistEarthTooltips = {
  [TRAIT.STONE_FLESH]: outsideScopeTooltip,
  [TRAIT.EARTHEN_BLAST]: traitTooltip(
    'Entering Earth in combat, or beginning an Earth overload, triggers a strike that cannot critically strike.'
  ),
  [TRAIT.GEOMANCERS_TRAINING]: traitTooltip('Earth-attuned skills recharge faster.', [
    ['rechargeMultiplier', 'Earth skill recharge', tooltipFactorChange]
  ]),
  [TRAIT.EARTHS_EMBRACE]: traitTooltip('Completing a healing skill grants resistance.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.SERRATED_STONES]: traitTooltip(
    'Bleeding lasts longer. Your strikes deal increased damage against bleeding targets.',
    [
      ['durationMultiplier', 'Bleeding duration', percentagePoints],
      fromProfile(
        TRAIT.SERRATED_STONES,
        'damageMultiplier',
        'Strike damage against bleeding targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.ELEMENTAL_SHIELDING]: traitTooltip('Gaining an aura grants protection.'),
  [TRAIT.STRENGTH_OF_STONE]: traitTooltip(
    'Gain condition damage from toughness. Immobilizing the target inflicts bleeding.',
    [
      ['attributeConversion', 'Toughness converted to condition damage', tooltipPercent],
      ['internalCooldown', 'Bleeding cooldown', tooltipSeconds]
    ]
  ),
  [TRAIT.ROCK_SOLID]: traitTooltip('Entering Earth in combat grants stability.'),
  [TRAIT.EARTHEN_BLESSING]: outsideScopeTooltip,
  [TRAIT.DIAMOND_SKIN]: outsideScopeTooltip,
  [TRAIT.WRITTEN_IN_STONE]: traitTooltip(
    'Signet of Fire retains its passive while recharging. Completing Signet of Restoration, Fire, or Earth grants its corresponding aura.'
  ),
  [TRAIT.STONE_HEART]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
