import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipSeconds,
  traitSkillTooltip,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Describe zeal tooltips from the selected balance data. */
export const guardianZealTooltips = {
  [TRAIT.ZEALOTS_RESOLUTION]: traitSkillTooltip(
    [ID.LESSER_SYMBOL_OF_RESOLUTION],
    'A qualifying strike after the target has lost enough health creates Lesser Symbol of Resolution. The hit crossing the threshold does not trigger it.',
    [['threshold', 'Required target health lost', tooltipPercent]]
  ),
  [TRAIT.SYMBOLIC_EXPOSURE]: traitTooltip(
    'Symbol hits inflict vulnerability. Deal increased strike damage to vulnerable targets.',
    [
      fromProfile(
        TRAIT.SYMBOLIC_EXPOSURE,
        'damageMultiplier',
        'Strike damage against vulnerable targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.SYMBOLIC_AVENGER]: traitTooltip(
    'Symbol hits grant stacking strike damage. New stacks replace the shortest remaining stack at the cap.',
    [
      fromProfile(TRAIT.SYMBOLIC_AVENGER, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
      fromProfile(TRAIT.SYMBOLIC_AVENGER, 'maximumDamageStacks', 'Maximum damage stacks', tooltipDecimal),
      ['pulseInterval', 'Stack duration', tooltipSeconds]
    ]
  ),
  [TRAIT.WRATHFUL_SPIRIT]: outsideScopeTooltip,
  [TRAIT.FIERY_WRATH]: traitTooltip('Deal increased strike damage to burning targets.', [
    fromProfile(TRAIT.FIERY_WRATH, 'damageMultiplier', 'Strike damage against burning targets', tooltipFactorChange)
  ]),
  [TRAIT.ZEALOUS_SCEPTER]: outsideScopeTooltip,
  [TRAIT.RENEWING_SPLENDOR]: outsideScopeTooltip,
  [TRAIT.ZEALOUS_BLADE]: traitTooltip(
    'Gain power, with an additional bonus while wielding a greatsword. Greatsword skills recharge faster.',
    [
      ['attributeBonuses.power', 'Power', tooltipDecimal],
      ['conditionalAttributeBonuses.power', 'Power with a greatsword', tooltipDecimal],
      ['rechargeMultiplier', 'Greatsword recharge duration', tooltipFactorChange]
    ]
  ),
  // Attribute facts use the same patchable fields as the build calculator and runtime.
  [TRAIT.KINDLED_ZEAL]: traitTooltip('Gain condition damage from eligible power.', [
    ['attributeConversion', 'Eligible power converted to condition damage', tooltipPercent]
  ]),
  [TRAIT.ETERNAL_ARMORY]: traitTooltip('Spirit weapon skills gain additional ammunition.', [
    ['resourceGain', 'Additional ammunition']
  ]),
  [TRAIT.SHATTERED_AEGIS]: outsideScopeTooltip,
  [TRAIT.FURIOUS_FOCUS]: traitSkillTooltip(
    [ID.LESSER_SYMBOL_OF_BLADES],
    'Activating Justice creates Lesser Symbol of Blades. Deal increased strike damage while you have fury.',
    (context) => [
      profileFact(context, TRAIT.FURIOUS_FOCUS, 'damageIncrease', 'Strike damage with fury', tooltipPercent),
      // The symbol skill owns its field duration independently of the trait's passive bonus.
      {
        name: 'Symbol field duration',
        detail: tooltipSeconds(
          tooltipNumber(requireSkillFromContext(context, ID.LESSER_SYMBOL_OF_BLADES).comboFields?.[0], 'duration')
        )
      }
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
