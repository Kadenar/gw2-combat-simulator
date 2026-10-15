import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { CHRONOMANCER_BALANCE_PROFILE_IDS as CHRONO } from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import { shatterTooltip } from '#gw2/professions/mesmer/app/tooltips/shared.js';

/** Describe chronomancer tooltips from the selected balance data. */
export const chronomancerTooltips = {
  skills: {
    ...Object.fromEntries(Object.keys(MESMER_CHRONOMANCER_SHATTERS).map((id) => [Number(id), shatterTooltip])),
    [ID.CONTINUUM_SPLIT]: skillTooltip(
      'Spend your clones to open a window whose duration counts yourself and each clone spent. At expiry, restore the captured cooldown, ammunition, and autoattack-chain state. Clones, damage, and boons are not rewound. Fragmentation extends the window.',
      [fromProfile(CHRONO.continuumSplit, 'durationPerTier', 'Window per shatter source', tooltipSeconds)]
    ),
    [ID.CONTINUUM_SHIFT]: skillTooltip(
      'End the active Continuum Split and restore its captured cooldown, ammunition, and autoattack-chain state immediately.'
    )
  },
  traits: {
    [TRAIT.TIME_SPLITTER]: traitTooltip(
      'Unlock Chronomancer, shield, wells, and its shatters. Continuum Split temporarily records cooldowns and illusion resources for restoration.'
    ),
    [TRAIT.FLOW_OF_TIME]: traitTooltip(
      'Gain critical-strike chance while alacrity is active, including for illusions.',
      [['criticalChance', 'Critical chance with alacrity', tooltipPercent]]
    ),
    [TRAIT.TIME_MARCHES_ON]: traitTooltip(
      'Alacrity applied to you is stronger: it increases your recharge rate by 50% instead of 25%. Movement speed is not simulated.'
    ),
    [TRAIT.DELAYED_REACTIONS]: traitTooltip(
      'Control effects from other skills can activate Danger Time, in addition to Time Sink.'
    ),
    [TRAIT.TIME_CATCHES_UP]: traitTooltip(
      'Eligible shatter packets deal increased damage against chilled, crippled, immobilized, or slowed targets.',
      [fromProfile(TRAIT.TIME_CATCHES_UP, 'damageMultiplier', 'Shatter strike damage', tooltipFactorChange)]
    ),
    [TRAIT.ALLS_WELL_THAT_ENDS_WELL]: outsideScopeTooltip,
    [TRAIT.DANGER_TIME]: traitTooltip(
      'Time Sink control effects temporarily increase critical damage for you and your illusions. Delayed Reactions allows other control effects to activate the bonus.',
      [
        ['criticalDamage', 'Critical damage', tooltipPercent],
        ['durationMultiplier', 'Bonus duration', tooltipSeconds]
      ]
    ),
    [TRAIT.ILLUSIONARY_REVERSION]: traitTooltip('Shattering exactly the required number of clones restores a clone.', [
      ['threshold', 'Clones spent'],
      ['resourceGain', 'Clones restored']
    ]),
    [TRAIT.TIME_BOMB]: traitTooltip(
      'Completing Time Sink arms a delayed explosion. Your strike damage increases until it explodes; another bomb cannot be armed while the timer is active.',
      [
        ['durationMultiplier', 'Explosion delay / bonus duration', tooltipSeconds],
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
      'Phantasms attack again before becoming clones, with increased strike damage.',
      [['damageMultiplier', 'Phantasm strike damage', tooltipFactorChange]]
    )
  }
} satisfies ProfessionTooltips;
