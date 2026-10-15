import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Describes Skirmishing from its active balance profiles without owning simulation behavior. */
export const rangerSkirmishingTooltips = {
  [TRAIT.TAIL_WIND]: traitTooltip('Swapping weapons in combat grants swiftness.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.FURIOUS_GRIP]: traitTooltip('Swapping weapons in combat grants fury.', [
    ['internalCooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.HUNTERS_TACTICS]: traitTooltip(
    'Gain personal strike damage and critical-strike chance when flanking. The simulator treats defiant targets as flanked.',
    [
      fromProfile(TRAIT.HUNTERS_TACTICS, 'damageMultiplier', 'Strike damage', tooltipFactorChange),
      ['criticalChance', 'Critical chance', tooltipPercent]
    ]
  ),
  [TRAIT.SHARPENED_EDGES]: traitTooltip('Critical hits from you and your pet have a chance to inflict bleeding.', [
    ['criticalChance', 'Chance on critical hit', tooltipPercent]
  ]),
  [TRAIT.PRIMAL_REFLEXES]: outsideScopeTooltip,
  [TRAIT.TRAPPERS_EXPERTISE]: traitTooltip(
    'Trap conditions last longer, using a separate multiplier for Flame Trap. Traps also cripple the target.',
    [
      ['durationMultiplier', 'Trap condition duration', tooltipFactorChange],
      ['coefficientMultiplier', 'Flame Trap condition duration', tooltipFactorChange]
    ]
  ),
  [TRAIT.FANG_AND_CLAW]: traitTooltip('Feline, avian, and drake pets gain precision and ferocity.', [
    ['attributeBonus', 'Pet precision'],
    ['weaponAttributeBonus', 'Pet ferocity']
  ]),
  [TRAIT.STRIDERS_STRENGTH]: traitTooltip('You and your pet gain power. Wielding a sword increases your bonus.', [
    ['attributeBonus', 'Base power'],
    ['weaponAttributeBonus', 'Power while wielding a sword']
  ]),
  [TRAIT.HIDDEN_BARBS]: traitTooltip('Bleeding deals increased damage.', [
    fromProfile(TRAIT.HIDDEN_BARBS, 'conditionDamageMultiplier', 'Bleeding damage', tooltipFactorChange)
  ]),
  [TRAIT.QUICK_DRAW]: traitTooltip(
    'Swapping weapons in combat grants quickness and opens a brief window. The next non-autoattack weapon skill used in that window has reduced recharge.',
    [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      ['duration', 'Quick Draw', tooltipSeconds],
      ['rechargeMultiplier', 'Next eligible skill recharge', tooltipFactorChange]
    ]
  ),
  [TRAIT.LIGHT_ON_YOUR_FEET]: traitTooltip(
    'Dodging or using an evade skill adds a temporary strike-damage and condition-duration bonus. Shortbow recharges faster; flanking extends selected shortbow conditions and Concussion Shot applies vulnerability.',
    [
      fromProfile(TRAIT.LIGHT_ON_YOUR_FEET, 'damageMultiplier', 'Strike damage during bonus', tooltipFactorChange),
      ['conditionDurationBonus', 'Condition duration during bonus', tooltipPercent],
      ['rechargeMultiplier', 'Shortbow recharge', tooltipFactorChange],
      ['durationExtension', 'Crossfire bleeding / Poison Volley poison extension', tooltipSeconds],
      ['immobilizeDurationExtension', 'Crippling Shot immobilize extension', tooltipSeconds]
    ]
  ),
  [TRAIT.VICIOUS_QUARRY]: traitTooltip('Gain ferocity and additional critical-strike chance while fury is active.', [
    ['attributeBonus', 'Ferocity'],
    ['criticalChance', 'Additional critical chance with fury', tooltipPercent]
  ])
} satisfies NonNullable<ProfessionTooltips['traits']>;
