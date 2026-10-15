import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describe defense tooltips from the selected balance data. */
export const warriorDefenseTooltips = {
  [TRAIT.THICK_SKIN]: traitTooltip('Starting a healing skill grants protection.'),
  [TRAIT.ADRENAL_HEALTH]: outsideScopeTooltip,
  [TRAIT.HARDENED_ARMOR]: outsideScopeTooltip,
  [TRAIT.SHIELD_MASTER]: outsideScopeTooltip,
  [TRAIT.DOGGED_MARCH]: outsideScopeTooltip,
  [TRAIT.CULL_THE_WEAK]: traitTooltip(
    'A qualifying burst hit inflicts weakness. Deal increased strike damage to weakened targets.',
    [
      fromProfile(
        TRAIT.CULL_THE_WEAK,
        'damageMultiplier',
        'Strike damage against weakened targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.DEFY_PAIN]: outsideScopeTooltip,
  [TRAIT.RESILIENT_ROLL]: outsideScopeTooltip,
  [TRAIT.MERCILESS_HAMMER]: traitTooltip(
    'Player control effects grant adrenaline. Hammer and mace strikes deal increased damage to defiant targets.',
    [
      ['resourceGain', 'Adrenaline gained'],
      fromProfile(TRAIT.MERCILESS_HAMMER, 'damageMultiplier', 'Hammer and mace strike damage', tooltipFactorChange)
    ]
  ),
  [TRAIT.LAST_STAND]: outsideScopeTooltip,
  [TRAIT.CLEANSING_IRE]: outsideScopeTooltip,
  [TRAIT.STALWART_STRENGTH]: traitTooltip(
    'Player control effects grant stability. Deal increased strike damage while you have stability.',
    [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      fromProfile(TRAIT.STALWART_STRENGTH, 'damageMultiplier', 'Strike damage with stability', tooltipFactorChange)
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
