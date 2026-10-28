import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { virtueBoons } from '#gw2/professions/guardian/app/tooltips/shared.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Describe virtues tooltips from the selected balance data. */
export const guardianVirtuesTooltips = {
  [TRAIT.INSPIRED_VIRTUE]: (balanceContext, entity) => {
    const tooltip = virtueBoons(
      'Activating a virtue grants the corresponding boon to the party. Deal increased strike damage for each different boon on you.'
    )(balanceContext, entity);
    return {
      ...tooltip,
      facts: [
        profileFact(balanceContext, TRAIT.INSPIRED_VIRTUE, 'damagePerBoon', 'Strike damage per boon', tooltipPercent),
        ...tooltip.facts
      ]
    };
  },
  [TRAIT.VIRTUE_OF_RESOLUTION]: traitTooltip(
    'Activating a virtue grants resolution. Resolution applications last longer.',
    [['durationMultiplier', 'Resolution duration', tooltipFactorChange]]
  ),
  [TRAIT.POWER_OF_THE_VIRTUOUS]: traitTooltip(
    'Gain condition damage from vitality. Virtues recharge faster; Firebrand tome dormancy is also shortened.',
    [
      ['attributeConversion', 'Vitality converted to condition damage'],
      ['rechargeMultiplier', 'Virtue recharge duration', tooltipFactorChange]
    ]
  ),
  [TRAIT.UNSCATHED_CONTENDER]: traitTooltip(
    'Deal increased strike damage at full health, as assumed by the combat simulation. Aegis grants an additional strike-damage bonus.',
    [
      fromProfile(TRAIT.UNSCATHED_CONTENDER, 'damageMultiplier', 'Full-health strike damage', tooltipFactorChange),
      fromProfile(TRAIT.UNSCATHED_CONTENDER, 'damageIncrease', 'Additional strike damage with aegis', tooltipPercent)
    ]
  ),
  [TRAIT.RESOLUTE_SUBCONSCIOUS]: outsideScopeTooltip,
  [TRAIT.MASTER_OF_CONSECRATIONS]: traitTooltip(
    'Purging Flames lasts longer: its fire field is extended and it keeps pulsing strikes and burning.',
    [['durationMultiplier', 'Purging Flames duration', tooltipFactorChange]]
  ),
  [TRAIT.INSPIRING_VIRTUE]: traitTooltip('Activating a virtue temporarily increases strike damage.', [
    fromProfile(TRAIT.INSPIRING_VIRTUE, 'damageIncrease', 'Strike damage during the bonus', tooltipPercent)
  ]),
  [TRAIT.ABSOLUTE_RESOLVE]: outsideScopeTooltip,
  [TRAIT.GLACIAL_HEART]: traitTooltip(
    'Glacial Blow replaces Mighty Blow. Healing when you disable, immobilize, or chill a foe is not simulated.'
  ),
  [TRAIT.PERMEATING_WRATH]: traitTooltip('Justice triggers burning after fewer qualifying hits.', [
    ['threshold', 'Hits per trigger']
  ]),
  [TRAIT.BATTLE_PRESENCE]: traitTooltip("Willbender's Phoenix Protocol alacrity also affects the party."),
  [TRAIT.INDOMITABLE_COURAGE]: traitTooltip(
    "Activating Courage grants stability. Dragonhunter's Courage passive triggers more frequently.",
    [['pulseInterval', 'Dragonhunter Courage passive interval', tooltipSeconds]]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
