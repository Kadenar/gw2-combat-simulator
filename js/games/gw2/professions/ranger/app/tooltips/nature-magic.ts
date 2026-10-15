import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Describes NatureMagic from its active balance profiles without owning simulation behavior. */
export const rangerNatureMagicTooltips = {
  [TRAIT.REJUVENATION]: traitTooltip(
    'Using an eligible beast skill grants regeneration to the party.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]],
    'party'
  ),
  [TRAIT.FORTIFYING_BOND]: traitTooltip(
    "Boons received from players are shared with your active pet using the ranger's boon duration. Permanent boon settings represent training-console pulses and also trigger sharing. Inactive in Beastmode; other NPC boons do not trigger sharing.",
    [['pulseInterval', 'Configured boon refresh interval', tooltipSeconds]],
    'summons'
  ),
  [TRAIT.LINGERING_MAGIC]: traitTooltip('Gain concentration.', [['attributeBonus', 'Concentration']]),
  [TRAIT.BOUNTIFUL_HUNTER]: traitTooltip(
    'You and your pet deal increased strike damage for each different boon affecting the respective attacker.',
    [
      fromProfile(TRAIT.BOUNTIFUL_HUNTER, 'damagePerBoon', 'Player strike damage per boon', tooltipPercent),
      fromProfile(TRAIT.BOUNTIFUL_HUNTER, 'damagePerBoon', 'Pet strike damage per boon', tooltipPercent)
    ]
  ),
  [TRAIT.WELLSPRING]: traitTooltip(
    'Gain healing power from power. Completing a healing skill grants regeneration to the party.',
    [['attributeConversion', 'Power converted to healing power', tooltipPercent]],
    'party'
  ),
  [TRAIT.ALLIES_AID]: outsideScopeTooltip,
  [TRAIT.EVASIVE_PURITY]: outsideScopeTooltip,
  [TRAIT.SPIRITED_ARRIVAL]: traitTooltip(
    'Swapping pets in combat grants might and fury to the party.',
    () => [],
    'party'
  ),
  [TRAIT.WINDBORNE_NOTES]: traitTooltip(
    'Completing a warhorn skill grants regeneration to the party.',
    () => [],
    'party'
  ),
  [TRAIT.NATURES_VENGEANCE]: traitTooltip(
    'Spirits repeat their slam after their final boon shake. Summon effects and boon pulses are not repeated.',
    [['baseDuration', 'Delay after final shake', tooltipSeconds]]
  ),
  [TRAIT.PROTECTIVE_WARD]: outsideScopeTooltip,
  [TRAIT.INVIGORATING_BOND]: outsideScopeTooltip
} satisfies NonNullable<ProfessionTooltips['traits']>;
