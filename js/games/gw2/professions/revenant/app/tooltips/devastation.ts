import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Describe devastation tooltips from the selected balance data. */
export const revenantDevastationTooltips = {
  [TRAIT.EXPOSE_DEFENSES]: traitTooltip('Your first qualifying strike after combat begins inflicts vulnerability.'),
  // Fixed runtime bonuses show both off-hand alternatives and the per-stack rate without requiring a selected build.
  [TRAIT.DESTRUCTIVE_IMPULSES]: traitTooltip(
    'Player-owned strikes and conditions deal increased damage. Wielding an off-hand weapon strengthens the bonus.',
    [
      ['damageIncrease', 'Strike damage without an off-hand weapon', tooltipPercent],
      ['conditionDamageIncrease', 'Condition damage without an off-hand weapon', tooltipPercent],
      ['offhandDamageIncrease', 'Strike damage with an off-hand weapon', tooltipPercent],
      ['offhandConditionDamageIncrease', 'Condition damage with an off-hand weapon', tooltipPercent]
    ]
  ),
  [TRAIT.TARGETED_DESTRUCTION]: traitTooltip(
    'Player-owned strikes deal increased damage for each vulnerability stack on the target.',
    [['damageIncreasePerStack', 'Strike damage per vulnerability stack', tooltipPercent]]
  ),
  [TRAIT.AGGRESSIVE_ARRIVAL]: outsideScopeTooltip,
  [TRAIT.UNSUSPECTING_STRIKES]: traitTooltip(
    'Player-owned strikes deal increased damage while the target remains above its high-health threshold.',
    [fromProfile(TRAIT.UNSUSPECTING_STRIKES, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.BATTLE_SCARRED]: traitTooltip(
    'Completing a healing skill grants Battle Scars. Qualifying player strikes consume a scar to deal life-siphon damage.'
  ),
  [TRAIT.ASSASSINS_PRESENCE]: traitTooltip('Periodically grant fury to the party during combat.', [
    ['cooldown', 'Fury interval', tooltipSeconds]
  ]),
  [TRAIT.NOTORIETY]: traitTooltip(
    'Legendary stance skills grant might. Your might grants more power and less condition damage.',
    [['attributePerStack', 'Additional power and reduced condition damage per might stack']]
  ),
  [TRAIT.THRILL_OF_COMBAT]: traitTooltip(
    'Periodically gain Battle Scars during combat. Qualifying player strikes consume a scar to deal life-siphon damage.',
    [['cooldown', 'ICD', tooltipSeconds]]
  ),
  [TRAIT.BRUTALITY]: traitTooltip('Completing a weapon swap grants quickness.', [
    ['cooldown', 'Internal cooldown', tooltipSeconds]
  ]),
  [TRAIT.SWIFT_TERMINATION]: traitTooltip(
    'Player-owned strikes deal increased damage while the target is below half health.',
    [fromProfile(TRAIT.SWIFT_TERMINATION, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
  ),
  [TRAIT.DANCE_OF_DEATH]: traitTooltip(
    'Applying vulnerability grants Battle Scars according to the stacks applied. Qualifying player strikes consume a scar to deal life-siphon damage.'
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
