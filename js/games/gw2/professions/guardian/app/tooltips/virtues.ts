import {
  attributeConversionFact,
  fromProfile,
  maximumBonusFact,
  outsideScopeTooltip,
  profileFact,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { balanceNumber, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { virtueBoons } from '#gw2/professions/guardian/app/tooltips/shared.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

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
        maximumBonusFact('damagePerBoon', 'maximumBoons', 'Maximum strike damage bonus')(balanceContext, entity.id),
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
      attributeConversionFact('Vitality', 'Condition Damage'),
      ['rechargeMultiplier', 'Virtue recharge duration', tooltipFactorChange]
    ]
  ),
  [TRAIT.UNSCATHED_CONTENDER]: traitTooltip(
    'Deal increased strike damage above the health threshold or with Aegis. Combat simulations assume full health.',
    [
      fromProfile(TRAIT.UNSCATHED_CONTENDER, 'damageIncrease', 'Strike damage', tooltipPercent),
      fromProfile(TRAIT.UNSCATHED_CONTENDER, 'threshold', 'Health threshold', tooltipPercent)
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
  // Willbender counts hits during Rushing Justice. Other guardians use the passive Justice counter.
  [TRAIT.PERMEATING_WRATH]: (context, trait, specialization) => {
    const willbender = specialization === 'Willbender';
    const base = willbender
      ? balanceNumber(context.catalog, TRAIT.WILLBENDER_TRAINING, 'threshold')
      : skillNumber(requireSkill(context.catalog, ID.JUSTICE), 'threshold');
    const hits = balanceNumber(context.catalog, trait.id, 'threshold');
    return {
      description: willbender
        ? 'Your strikes trigger burning more often while Rushing Justice is active.'
        : 'Your strikes trigger the passive burning from Justice more often.',
      facts: [{ name: 'Burning', detail: `Every ${hits} hits (normally ${base})` }]
    };
  },
  [TRAIT.BATTLE_PRESENCE]: traitTooltip(
    'Share Resolve passive healing with nearby allies. Healing is outside simulation scope.'
  ),
  [TRAIT.INDOMITABLE_COURAGE]: (context, trait, specialization, build) => {
    // Only Dragonhunter has the passive aegis pulse. Include it in the general trait reference as well.
    const showAegis = !build || specialization === 'Dragonhunter';
    const activation = 'Activating Courage grants stability to you and nearby allies.';
    return traitTooltip(
      showAegis
        ? `${activation} On Dragonhunter, Shield of Courage grants you aegis more often while ready.`
        : activation,
      showAegis ? [['pulseInterval', 'Aegis interval on Dragonhunter', tooltipSeconds]] : []
    )(context, trait);
  }
} satisfies NonNullable<ProfessionTooltips['traits']>;
