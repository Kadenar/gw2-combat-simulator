import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Describe retribution tooltips from the selected balance data. */
export const revenantRetributionTooltips = {
  [TRAIT.ENDURING_RECOVERY]: traitTooltip('Endurance regenerates faster.', [
    ['enduranceRegenerationMultiplier', 'Endurance regeneration', tooltipFactorChange]
  ]),
  [TRAIT.UNWAVERING_AVOIDANCE]: outsideScopeTooltip,
  [TRAIT.DETERMINED_RESOLUTION]: outsideScopeTooltip,
  [TRAIT.PLANAR_PROTECTION]: outsideScopeTooltip,
  [TRAIT.CLOSE_QUARTERS]: outsideScopeTooltip,
  [TRAIT.SPIRITUAL_RECKONING]: outsideScopeTooltip,
  [TRAIT.SET_IN_STONE]: outsideScopeTooltip,
  [TRAIT.RESOLUTE_EVASION]: outsideScopeTooltip,
  [TRAIT.DWARVEN_BATTLE_TRAINING]: traitTooltip(
    'Control effects apply weakness. Player-owned strikes deal increased damage to weakened targets.',
    [
      fromProfile(
        TRAIT.DWARVEN_BATTLE_TRAINING,
        'damageMultiplier',
        'Strike damage against weakened targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.VICIOUS_REPRISAL]: traitTooltip(
    'Resolution increases player-owned strike and condition damage. Qualifying strikes with resolution grant might.',
    [
      fromProfile(TRAIT.VICIOUS_REPRISAL, 'damageIncrease', 'Strike damage with resolution', tooltipPercent),
      fromProfile(
        TRAIT.VICIOUS_REPRISAL,
        'conditionDamageIncrease',
        'Condition damage with resolution',
        tooltipPercent
      ),
      ['cooldown', 'Might cooldown', tooltipSeconds]
    ]
  ),
  [TRAIT.VERSED_IN_STONE]: traitTooltip('Gain power from the common toughness attribute pool.', [
    ['attributeConversion', 'Toughness converted to power', tooltipPercent]
  ]),
  [TRAIT.STEADFAST_REJUVENATION]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
