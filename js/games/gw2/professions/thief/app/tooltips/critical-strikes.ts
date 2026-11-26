import {
  attributeConversionFact,
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  tooltipFactorChange,
  tooltipPercent,
  tooltipPercentValue,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Describe critical strikes tooltips from the selected balance data. */
export const thiefCriticalStrikesTooltips = {
  [TRAIT.KEEN_OBSERVER]: traitTooltip(
    'Gain critical-strike chance. The full-health bonus applies in combat simulation.',
    [['criticalChance', 'Critical chance at full player health', tooltipPercent]]
  ),
  [TRAIT.UNRELENTING_STRIKES]: traitTooltip(
    'Eligible critical hits grant fury to the party.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]],
    RECIPIENT.PARTY
  ),
  [TRAIT.FEROCIOUS_STRIKES]: traitTooltip('Critical strikes deal increased damage against targets above half health.', [
    ['criticalDamage', 'Critical damage', tooltipFactorChange]
  ]),
  [TRAIT.ASSASSINS_FURY]: traitTooltip('Receiving fury on yourself grants might.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.SIGNETS_OF_POWER]: traitTooltip('Activating a signet restores initiative.', [
    ['resourceGain', 'Initiative restored']
  ]),
  [TRAIT.TWIN_FANGS]: traitTooltip(
    'Deal increased critical damage, which is further increased while your health is above the threshold. Gain bonus critical-hit chance for a duration after hitting a foe from behind or the side or when they are defiant. Combat simulation always applies the high-health critical-damage bonus and triggers the critical-chance buff after a direct hit against a defiant target. Further qualifying hits refresh the buff; flanking non-defiant targets is not modeled.',
    [
      ['threshold', 'Health threshold', tooltipPercentValue],
      ['criticalDamage', 'Critical damage increase', tooltipFactorChange],
      ['highHealthCriticalDamage', 'High-health critical damage increase', tooltipPercent],
      ['criticalChance', 'Critical chance increase while active', tooltipPercent],
      ['duration', 'Bonus duration', tooltipSeconds]
    ]
  ),
  [TRAIT.SUNDERING_SHADE]: traitTooltip('Completing a stealth attack inflicts vulnerability.'),
  [TRAIT.PRACTICED_TOLERANCE]: traitTooltip(
    'Gain ferocity based on precision. Bonuses from other attribute conversions do not count.',
    [attributeConversionFact('Precision', 'Ferocity')]
  ),
  [TRAIT.DEADLY_AIM]: traitTooltip('Pistol strikes deal increased damage.', [
    fromProfile(TRAIT.DEADLY_AIM, 'damageMultiplier', 'Pistol strike damage', tooltipFactorChange)
  ]),
  [TRAIT.NO_QUARTER]: (balanceContext, entity) => ({
    description:
      'Gain ferocity while you have fury. Eligible critical hits extend fury only if it was already active before the hit.',
    facts: [
      profileFact(balanceContext, entity.id, 'attributeBonuses.ferocity', 'Ferocity with fury'),
      profileFact(balanceContext, entity.id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
      ...simulationEffectFacts(tooltipProfile(balanceContext, entity.id).effects, 'extension of existing fury').facts
    ]
  }),
  [TRAIT.HIDDEN_KILLER]: traitTooltip('Gain critical-strike chance during stealth and briefly after leaving it.', [
    ['criticalChance', 'Critical chance', tooltipPercent],
    ['duration', 'Bonus duration after leaving stealth', tooltipSeconds]
  ]),
  [TRAIT.INVIGORATING_PRECISION]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
