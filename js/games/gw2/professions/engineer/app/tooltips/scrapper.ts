import {
  fromProfile,
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe scrapper tooltips from the selected balance data. */
export const scrapperTooltips = {
  skills: {},
  traits: {
    [TRAIT.FUNCTION_GYRO]: traitTooltip('Unlock Function Gyro, which can trigger supported gyro and toolbelt traits.'),
    [TRAIT.SPEED_OF_SYNERGY]: traitTooltip(
      'Healing skills and their toolbelt skills grant superspeed. Equipping Med Kit is excluded; its toolbelt uses the longer duration.'
    ),
    [TRAIT.IMPACT_SAVANT]: outsideScopeTooltip,
    [TRAIT.GYROSCOPIC_ACCELERATION]: traitTooltip('Well skills and Function Gyro grant superspeed.'),
    [TRAIT.SYSTEM_SHOCKER]: traitTooltip('Function Gyro applies a daze control event.'),
    [TRAIT.MASS_MOMENTUM]: traitTooltip(
      'Function Gyro grants stability. While stability is active, periodically gain might.',
      [['pulseInterval', 'Might interval', tooltipSeconds]]
    ),
    [TRAIT.RAPID_REGENERATION]: outsideScopeTooltip,
    [TRAIT.EXPERT_EXAMINATION]: outsideScopeTooltip,
    [TRAIT.OBJECT_IN_MOTION]: traitTooltip(
      'Stability, swiftness, and superspeed each increase player strike damage. Their factors multiply when several are active.',
      [fromProfile(TRAIT.OBJECT_IN_MOTION, 'damageMultiplier', 'Strike damage per active status', tooltipFactorChange)]
    ),
    [TRAIT.EX_MACHINA]: traitTooltip('Function Gyro gains ammunition.', [
      ['maximumAmmo', 'Minimum Function Gyro ammunition']
    ]),
    [TRAIT.KINETIC_ACCELERATORS]: traitTooltip(
      'Successful blast, leap, and whirl combos grant quickness and might to the party. Function Gyro becomes a blast finisher. Gain concentration from eligible power.',
      [
        ['internalCooldown', 'Whirl-combo boon cooldown', tooltipSeconds],
        ['attributeConversion', 'Eligible power converted to concentration', tooltipPercent]
      ]
    ),
    [TRAIT.APPLIED_FORCE]: traitTooltip(
      'Might grants additional power. Reaching the might threshold grants stability.',
      [
        ['attributePerStack', 'Additional power per might stack'],
        ['maximumStacks', 'Maximum might stacks counted'],
        ['threshold', 'Might needed for stability'],
        ['internalCooldown', 'Stability cooldown', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
