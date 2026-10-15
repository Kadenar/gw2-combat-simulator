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
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { shatterTooltip } from '#gw2/professions/mesmer/app/tooltips/shared.js';

/** Describe virtuoso tooltips from the selected balance data. */
export const virtuosoTooltips = {
  skills: {
    ...Object.fromEntries(Object.keys(MESMER_VIRTUOSO_SHATTERS).map((id) => [Number(id), shatterTooltip])),
    [ID.BLADE_RENEWAL]: skillTooltip(
      'Fill your stocked blades. The defensive animation does not model incoming damage.'
    )
  },
  traits: {
    [TRAIT.PSYCHIC_BLADES]: traitTooltip(
      'Unlock Virtuoso, dagger, psionics, blades, and bladesongs. Blade resources replace clones.'
    ),
    [TRAIT.DEADLY_BLADES]: traitTooltip(
      'Blade critical hits inflict vulnerability. Completing a bladesong temporarily increases personal strike and condition damage.',
      [
        fromProfile(TRAIT.DEADLY_BLADES, 'damageIncrease', 'Strike damage', tooltipPercent),
        fromProfile(TRAIT.DEADLY_BLADES, 'conditionDamageIncrease', 'Condition damage', tooltipPercent),
        ['durationMultiplier', 'Damage-bonus duration', tooltipSeconds]
      ]
    ),
    [TRAIT.QUIET_INTENSITY]: traitTooltip(
      'Gain ferocity from vitality and additional personal critical-strike chance while fury is active.',
      [
        ['vitalityConversion', 'Vitality converted to ferocity', tooltipPercent],
        ['criticalChance', 'Additional critical chance with fury', tooltipPercent]
      ]
    ),
    [TRAIT.BLADETURN_REFRAIN]: outsideScopeTooltip,
    [TRAIT.MENTAL_FOCUS]: traitTooltip(
      'Your strikes deal increased damage. The simulator always assumes a nearby target.',
      [fromProfile(TRAIT.MENTAL_FOCUS, 'damageMultiplier', 'Nearby strike damage', tooltipFactorChange)]
    ),
    [TRAIT.JAGGED_MIND]: traitTooltip('Critical blade strikes inflict bleeding.'),
    [TRAIT.DUELISTS_REVERSAL]: outsideScopeTooltip,
    [TRAIT.PHANTASMAL_BLADES]: traitTooltip(
      "A phantasm's completed attack lifecycle fires an additional blade strike."
    ),
    [TRAIT.SHARPENING_SORROW]: traitTooltip('Gain expertise while fury is assumed active.', [
      ['expertiseBonus', 'Expertise']
    ]),
    [TRAIT.PSYCHIC_RIPOSTE]: outsideScopeTooltip,
    [TRAIT.INFINITE_FORGE]: traitTooltip(
      'Periodically stock a blade. Spending enough blades on a bladesong refunds blades. Blade attacks deal increased strike damage.',
      [
        ['pulseInterval', 'Blade generation interval', tooltipSeconds],
        ['playerStacks', 'Blades per interval'],
        ['threshold', 'Blades spent to trigger refund'],
        ['resourceGain', 'Blades refunded'],
        fromProfile(TRAIT.INFINITE_FORGE, 'damageMultiplier', 'Blade strike damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.BLOODSONG]: traitTooltip(
      'Bleeding deals increased damage. Applying enough bleeding stacks stocks a blade.',
      [
        fromProfile(TRAIT.BLOODSONG, 'conditionDamageMultiplier', 'Bleeding damage', tooltipFactorChange),
        ['threshold', 'Bleeding stacks to stock blades'],
        ['resourceGain', 'Blades stocked']
      ]
    )
  }
} satisfies ProfessionTooltips;
