import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  tooltipNumber,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Describes WildernessSurvival from its active balance profiles without owning simulation behavior. */
export const rangerWildernessSurvivalTooltips = {
  [TRAIT.NATURAL_VIGOR]: traitTooltip('Endurance regenerates faster.', [
    ['vigorRegenerationMultiplier', 'Endurance regeneration', tooltipPercent]
  ]),
  [TRAIT.COMPANIONS_DEFENSE]: outsideScopeTooltip,
  [TRAIT.RUGGED_GROWTH]: outsideScopeTooltip,
  [TRAIT.CHILD_OF_EARTH]: traitSkillTooltip(
    [ID.LESSER_MUDDY_TERRAIN],
    'Completing a healing skill invokes Lesser Muddy Terrain, immobilizing once and repeatedly crippling and slowing the target.',
    (context) => {
      // Read cadence from the surviving repeating condition rather than duplicating skill tuning.
      const effect = requireSkillFromContext(context, ID.LESSER_MUDDY_TERRAIN).effects?.find(
        (effect) => effect.type === 'condition' && Number(effect.applications) > 1
      );
      return effect
        ? [{ name: 'Pulse interval', detail: tooltipSeconds(tooltipNumber(effect, 'intervalMs') / 1000) }]
        : [];
    }
  ),
  [TRAIT.OAKHEART_SALVE]: outsideScopeTooltip,
  [TRAIT.ARACHNOPHOBIA]: traitTooltip(
    'Gain expertise, with an additional expertise bonus for spider and devourer pets. Their Spit or Twin Darts inflicts torment; Twin Darts splits the duration across its projectiles.',
    [
      ['attributeBonuses.expertise', 'Expertise'],
      ['conditionalAttributeBonuses.expertise', 'Additional spider / devourer expertise']
    ],
    'Spit; Twin Darts divides duration per projectile'
  ),
  [TRAIT.AMBIDEXTERITY]: traitTooltip(
    'Gain condition damage, increased while wielding a dagger, mace, or torch. Dagger and torch skills recharge faster.',
    [
      ['attributeBonuses.conditionDamage', 'Base condition damage'],
      ['conditionalAttributeBonuses.conditionDamage', 'Condition damage with a dagger, mace, or torch'],
      ['rechargeMultiplier', 'Dagger / torch recharge', tooltipFactorChange]
    ]
  ),
  [TRAIT.SURVIVAL_INSTINCTS]: traitTooltip(
    'Gain personal strike damage. Your full-health bonus applies throughout combat.',
    [fromProfile(TRAIT.SURVIVAL_INSTINCTS, 'damageIncrease', 'Strike damage', tooltipPercent)]
  ),
  [TRAIT.EMPATHIC_BOND]: outsideScopeTooltip,
  [TRAIT.CARNIVORE]: traitTooltip(
    'Player and pet control effects trigger a life-steal strike that cannot critically strike.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.WILDERNESS_KNOWLEDGE]: outsideScopeTooltip,
  [TRAIT.POISON_MASTER]: traitTooltip(
    "Your poison deals increased damage. Using an eligible beast skill prepares the pet's next strike to apply additional player-owned poison.",
    [fromProfile(TRAIT.POISON_MASTER, 'conditionDamageMultiplier', 'Player poison damage', tooltipFactorChange)]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
