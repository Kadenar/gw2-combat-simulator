import {
  fromProfile,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitSkillTooltip,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { lifeForce } from '#gw2/professions/necromancer/app/tooltips/shared.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Describe spite tooltips from the selected balance data. */
export const necromancerSpiteTooltips = {
  [TRAIT.REAPERS_MIGHT]: traitTooltip('The first hit of shroud skill 1 grants might.', undefined, 'on shroud skill 1'),
  // Shroud-entry boons and imperative procs are not included in the automatic trait-profile facts.
  [TRAIT.AWAKEN_THE_PAIN]: traitTooltip('Might grants additional power. Entering shroud grants might.', [
    ['attributePerStack', 'Power per stack of might']
  ]),
  [TRAIT.SIPHONED_POWER]: traitTooltip(
    'Striking a low-health target grants might.',
    [
      ['cooldown', 'Internal cooldown', tooltipSeconds],
      ['threshold', 'Target health below', tooltipPercent]
    ],
    'against a low-health target'
  ),
  [TRAIT.SPITEFUL_TALISMAN]: traitTooltip('Increases strike damage.', [
    fromProfile(TRAIT.SPITEFUL_TALISMAN, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
  ]),
  [TRAIT.MALICIOUS_SWARM]: traitSkillTooltip(
    [ID.LESSER_SIGNET_OF_THE_LOCUST],
    'Using a healing skill invokes Lesser Signet of the Locust.'
  ),
  [TRAIT.BITTER_CHILL]: traitTooltip('Applying chill also applies vulnerability.'),
  [TRAIT.CHILL_OF_DEATH]: traitSkillTooltip(
    [ID.LESSER_SPINAL_SHIVERS],
    'Striking a low-health target invokes Lesser Spinal Shivers. Chill follows the strike; target boon removal is not simulated.',
    [['threshold', 'Target health below', tooltipPercent]]
  ),
  [TRAIT.SPITEFUL_FORTITUDE]: traitTooltip(
    'Gain vitality from power. Player strikes against a low-health target generate life force.',
    [
      ['attributeConversion', 'Power converted to vitality', tooltipPercent],
      ['threshold', 'Life force target health threshold', tooltipPercent],
      ['lifeForceGain', 'Life force gained', lifeForce]
    ]
  ),
  [TRAIT.SIGNETS_OF_SUFFERING]: traitTooltip(
    'Activating a signet deals life-steal damage. Signet passives remain active while recharging in shroud.'
  ),
  [TRAIT.DREAD]: traitTooltip('Fear briefly increases your strike damage.', [
    ['duration', 'Damage bonus duration', tooltipSeconds],
    fromProfile(TRAIT.DREAD, 'damageIncrease', 'Strike damage', tooltipPercent)
  ]),
  [TRAIT.CLOSE_TO_DEATH]: traitTooltip('Deal increased strike damage to low-health targets.', [
    ['threshold', 'Target health below', tooltipPercent],
    fromProfile(TRAIT.CLOSE_TO_DEATH, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
  ]),
  [TRAIT.SPITEFUL_SPIRIT]: traitTooltip('Entering shroud triggers a strike.')
} satisfies NonNullable<ProfessionTooltips['traits']>;
