import {
  fromProfile,
  outsideScopeTooltip,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  lifeForce,
  conditionTransferTooltip,
  flipTooltip,
  shroudTooltip
} from '#gw2/professions/necromancer/app/tooltips/shared.js';

/** Describe reaper tooltips from the selected balance data. */
export const reaperTooltips = {
  skills: {
    [ID.SUFFER]: conditionTransferTooltip,
    [ID.INFUSING_TERROR]: flipTooltip,
    [ID.REAPERS_SHROUD]: shroudTooltip,
    [ID.EXIT_REAPERS_SHROUD]: shroudTooltip,
    [ID.DEATHS_CHARGE]: skillTooltip('Charge through your target, striking repeatedly and applying blindness.')
  },
  traits: {
    [TRAIT.SHROUD_KNIGHT]: traitTooltip("This specialization uses Reaper's Shroud and its melee shroud skills."),
    [TRAIT.SHIVERS_OF_DREAD]: traitTooltip('Applying fear also inflicts chill.', undefined, 'on fear'),
    [TRAIT.COLD_SHOULDER]: traitTooltip('Deal increased strike damage to chilled targets.', [
      fromProfile(TRAIT.COLD_SHOULDER, 'damageMultiplier', 'Strike damage against chilled targets', tooltipFactorChange)
    ]),
    [TRAIT.AUGURY_OF_DEATH]: traitTooltip(
      'Shouts trigger life-steal damage. The simulator assumes melee range, including the doubled siphon damage.',
      undefined,
      'on shout'
    ),
    [TRAIT.CHILLING_NOVA]: traitTooltip(
      'Critical hits against chilled targets trigger an explosion and chill.',
      [['cooldown', 'Internal cooldown', tooltipSeconds]],
      'on eligible critical hit'
    ),
    [TRAIT.RELENTLESS_PURSUIT]: outsideScopeTooltip,
    [TRAIT.SOUL_EATER]: traitTooltip(
      'Deal increased strike damage; the simulator always assumes a nearby target. Healing is outside simulation scope.',
      [fromProfile(TRAIT.SOUL_EATER, 'damageMultiplier', 'Strike damage near target', tooltipFactorChange)]
    ),
    [TRAIT.CHILLING_VICTORY]: traitTooltip('Striking chilled targets generates life force.', [
      ['lifeForceGain', 'Life force gained', lifeForce],
      ['cooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.DECIMATE_DEFENSES]: traitTooltip('Gain critical-strike chance for vulnerability on the target.', [
      ['criticalChancePerStack', 'Critical chance per vulnerability stack', tooltipPercent],
      ['maximumStacks', 'Maximum counted stacks', String]
    ]),
    [TRAIT.BLIGHTERS_BOON]: traitTooltip('Gaining boons generates life force.', [
      ['lifeForceGain', 'Life force gained', lifeForce]
    ]),
    [TRAIT.DEATHLY_CHILL]: traitTooltip('Applying chill also inflicts bleeding.', undefined, 'on chill'),
    [TRAIT.REAPERS_ONSLAUGHT]: traitTooltip(
      "Gain ferocity in Reaper's Shroud. Completing the shroud autoattack chain reduces shroud skill recharge.",
      [
        ['attributeBonuses.ferocity', 'Ferocity in shroud'],
        ['rechargeReduction', 'Recharge reduction', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
