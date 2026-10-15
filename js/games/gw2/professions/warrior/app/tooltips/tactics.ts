import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Describe tactics tooltips from the selected balance data. */
export const warriorTacticsTooltips = {
  [TRAIT.MARCHING_ORDERS]: traitTooltip(
    "The first eligible burst hit activates Soldier's Focus and grants might to the party.",
    [['internalCooldown', "Soldier's Focus cooldown", tooltipSeconds]]
  ),
  [TRAIT.EMPOWERED]: traitTooltip('Deal increased strike damage for each different boon on you.', [
    fromProfile(TRAIT.EMPOWERED, 'damagePerBoon', 'Strike damage per boon', tooltipPercent)
  ]),
  [TRAIT.MENDING_MIGHT]: outsideScopeTooltip,
  [TRAIT.LEG_SPECIALIST]: traitTooltip(
    'Cripple applications also immobilize. Deal increased strike damage to crippled, chilled, or immobilized targets.',
    [
      fromProfile(
        TRAIT.LEG_SPECIALIST,
        'damageMultiplier',
        'Strike damage against affected targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.SOLDIERS_COMFORT]: traitTooltip(
    "Soldier's Focus grants protection to the party. Healing is outside combat simulation scope."
  ),
  [TRAIT.ROARING_REVEILLE]: traitTooltip('Gain concentration.', [['attributeBonus', 'Concentration']]),
  [TRAIT.WARRIORS_CUNNING]: traitTooltip(
    'Deal increased strike damage while the target is above the high-health threshold.',
    [fromProfile(TRAIT.WARRIORS_CUNNING, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.SHRUG_IT_OFF]: outsideScopeTooltip,
  [TRAIT.EMPOWER_ALLIES]: traitTooltip('Periodically grant might to the party.', [
    ['pulseInterval', 'Pulse interval', tooltipSeconds]
  ]),
  [TRAIT.MARTIAL_CADENCE]: traitTooltip(
    "Soldier's Focus grants stability to the party. Weapon swaps make Soldier's Focus ready again."
  ),
  [TRAIT.VIGOROUS_SHOUTS]: traitTooltip('Gain healing power based on power.', [
    ['attributeConversion', 'Power converted to healing power', tooltipPercent]
  ]),
  [TRAIT.PHALANX_STRENGTH]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
