import {
  fromProfile,
  fromSkill,
  outsideScopeTooltip,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { shatterTooltip } from '#gw2/professions/mesmer/app/tooltips/shared.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';

/** Describe chronomancer tooltips from the selected balance data. */
export const chronomancerTooltips = {
  skills: {
    ...Object.fromEntries(Object.keys(MESMER_CHRONOMANCER_SHATTERS).map((id) => [Number(id), shatterTooltip])),
    [ID.CONTINUUM_SPLIT]: skillTooltip(
      'Spend your clones to start Continuum Split. Its duration increases for you and each clone spent. When it ends, restore your starting cooldowns and ammunition. Autoattack chains continue normally. Clones, damage, and boons are not restored. Fragmentation extends the duration.',
      [fromSkill(ID.CONTINUUM_SPLIT, 'durationPerTier', 'Window per shatter source', tooltipSeconds)]
    ),
    [ID.CONTINUUM_SHIFT]: skillTooltip(
      'End Continuum Split and restore the cooldowns and ammunition recorded when it began. Autoattack chains continue normally.'
    )
  },
  traits: {
    // Continuum restores cooldowns and ammunition. It does not restore spent clones.
    [TRAIT.TIME_SPLITTER]: traitTooltip(
      'Unlock Chronomancer, shield, wells, and its shatters. Continuum Split records your cooldowns and ammunition and restores them when it ends.'
    ),
    [TRAIT.FLOW_OF_TIME]: traitTooltip(
      'Gain critical-strike chance while alacrity is active, including for illusions.',
      [['criticalChance', 'Critical chance with alacrity', tooltipPercent]]
    ),
    [TRAIT.TIME_MARCHES_ON]: traitTooltip(
      'Alacrity increases your recharge rate by 50% instead of 25%. Movement speed is not simulated.'
    ),
    [TRAIT.DELAYED_REACTIONS]: traitTooltip(
      'Control effects from other skills can activate Danger Time, in addition to Time Sink.'
    ),
    [TRAIT.TIME_CATCHES_UP]: traitTooltip(
      'Eligible shatter hits deal increased damage against chilled, crippled, immobilized, or slowed targets.',
      [fromProfile(TRAIT.TIME_CATCHES_UP, 'damageMultiplier', 'Shatter strike damage', tooltipFactorChange)]
    ),
    [TRAIT.ALLS_WELL_THAT_ENDS_WELL]: outsideScopeTooltip,
    [TRAIT.DANGER_TIME]: traitTooltip(
      'Time Sink control effects temporarily increase critical damage for you and your illusions. Delayed Reactions allows other control effects to activate the bonus.',
      [
        ['criticalDamage', 'Critical damage', tooltipPercent],
        ['duration', 'Bonus duration', tooltipSeconds]
      ]
    ),
    [TRAIT.ILLUSIONARY_REVERSION]: traitTooltip('Shattering exactly the required number of clones restores a clone.', [
      ['threshold', 'Clones spent'],
      ['resourceGain', 'Clones restored']
    ]),
    [TRAIT.TIME_BOMB]: traitTooltip(
      'Completing Time Sink arms a delayed explosion. Your strike damage increases until it explodes; another bomb cannot be armed while the timer is active.',
      [
        ['duration', 'Explosion delay / bonus duration', tooltipSeconds],
        fromProfile(TRAIT.TIME_BOMB, 'damageMultiplier', 'Strike damage while armed', tooltipFactorChange)
      ]
    ),
    [TRAIT.STRETCHED_TIME]: traitTooltip(
      'Shattering grants alacrity to the party. Add duration for yourself and for each clone spent to the listed base duration.',
      [['durationPerTier', 'Additional duration per player / clone tier', tooltipSeconds]],
      'base duration before tiers'
    ),
    [TRAIT.SEIZE_THE_MOMENT]: traitTooltip(
      'Shattering grants quickness to the party. Add duration for yourself and for each clone spent to the listed base duration.',
      [['durationPerTier', 'Additional duration per player / clone tier', tooltipSeconds]],
      'base duration before tiers'
    ),
    [TRAIT.CHRONOPHANTASMA]: traitTooltip(
      'Phantasms attack again before becoming clones. Resummoned phantasms deal normal strike damage. Their condition-duration reduction is unknown and not yet applied.',
      [['damageMultiplier', 'Phantasm strike damage', tooltipFactorChange]]
    )
  }
} satisfies ProfessionTooltips;
