import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitSkillTooltip,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Describes Marksmanship from its active balance profiles without owning simulation behavior. */
export const rangerMarksmanshipTooltips = {
  [TRAIT.OPENING_STRIKE]: traitTooltip(
    "Your first qualifying strike and your pet's first qualifying strike independently inflict vulnerability."
  ),
  [TRAIT.ALPHA_FOCUS]: traitTooltip('Opening Strike also cripples the target.'),
  [TRAIT.PRECISE_STRIKE]: traitTooltip('Opening Strike gains critical-strike chance for you and your pet.', [
    ['criticalChance', 'Opening Strike critical chance', tooltipPercent]
  ]),
  [TRAIT.STONEFORM]: outsideScopeTooltip,
  [TRAIT.HUNTERS_GAZE]: traitTooltip(
    'Your strikes grant might against low-health targets. Lower target-health tiers grant more stacks.',
    [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      ['maximumStacks', 'Might stacks in the lowest health tier'],
      ['lowerThreshold', 'Lowest target-health threshold', tooltipPercent],
      ['threshold', 'Middle target-health threshold', tooltipPercent],
      ['upperThreshold', 'Highest target-health threshold', tooltipPercent]
    ],
    'base application; stacks depend on target health'
  ),
  [TRAIT.CLARION_BOND]: traitSkillTooltip(
    [ID.LESSER_CALL_OF_THE_WILD],
    'Swapping pets invokes Lesser Call of the Wild, granting party boons and applying weakness with a blast finisher.'
  ),
  [TRAIT.WOLFSONG]: traitTooltip(
    'Your strikes deal increased damage against vulnerable targets. Using a beast skill with a canine pet inflicts vulnerability.',
    [fromProfile(TRAIT.WOLFSONG, 'damageMultiplier', 'Strike damage against vulnerable targets', tooltipFactorChange)]
  ),
  [TRAIT.FARSIGHTED]: traitTooltip('Your weapon skills deal increased strike damage.', [
    fromProfile(TRAIT.FARSIGHTED, 'damageMultiplier', 'Weapon strike damage', tooltipFactorChange)
  ]),
  [TRAIT.MOMENT_OF_CLARITY]: outsideScopeTooltip,
  [TRAIT.PREDATORS_ONSLAUGHT]: traitTooltip(
    'You and your pet deal increased strike damage against movement-impaired targets.',
    [
      fromProfile(TRAIT.PREDATORS_ONSLAUGHT, 'damageMultiplier', 'Player strike damage', tooltipFactorChange),
      fromProfile(TRAIT.PREDATORS_ONSLAUGHT, 'damageMultiplier', 'Pet strike damage', tooltipFactorChange)
    ]
  ),
  [TRAIT.REMORSELESS]: traitTooltip(
    'Receiving fury on yourself refreshes Opening Strike for you and your pet. Opening Strike deals increased damage.',
    [fromProfile(TRAIT.REMORSELESS, 'damageMultiplier', 'Opening Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.LEAD_THE_WIND]: traitTooltip(
    'Longbow skills recharge faster. Point-Blank Shot grants swiftness and quickness.',
    [['rechargeMultiplier', 'Longbow recharge', tooltipFactorChange]]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
