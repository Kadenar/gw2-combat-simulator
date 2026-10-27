import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  profileFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
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
    'Gain critical-strike damage, with the full-health bonus active in combat. Gain critical-strike chance against defiant targets.',
    [
      ['criticalDamage', 'Critical damage at full health', tooltipFactorChange],
      ['criticalChance', 'Critical chance against defiant targets', tooltipPercent]
    ]
  ),
  [TRAIT.SUNDERING_SHADE]: traitTooltip('Completing a stealth attack inflicts vulnerability.'),
  [TRAIT.PRACTICED_TOLERANCE]: traitTooltip('Gain ferocity from eligible precision.', [
    ['attributeConversion', 'Eligible precision converted to ferocity', tooltipPercent]
  ]),
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

/** Only the preview turns positional eligibility into an earned, expiring critical-chance window. */
export const thiefCriticalStrikesReworkTooltips = {
  [TRAIT.TWIN_FANGS]: traitTooltip(
    'A direct hit against a defiant target grants critical chance to later hits. Refresh replaces the window; its duration is provisional. Full-health critical damage is unchanged.',
    [
      ['criticalDamage', 'Critical damage at full health', tooltipFactorChange],
      ['criticalChance', 'Critical chance while active', tooltipPercent],
      ['duration', 'Provisional bonus duration', tooltipSeconds]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
