import {
  attributeConversionFact,
  fromProfile,
  maximumBonusFact,
  outsideScopeTooltip,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipHasTrait,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Describe scrapper tooltips from the selected balance data. */
export const scrapperTooltips = {
  skills: {
    [ID.BYPASS_COATING]: skillTooltip(
      'Coat nearby allies to grant superspeed. The simulation does not track movement speed.'
    ),
    [ID.MEDIC_GYRO]: skillTooltip('Deploy a gyro that heals nearby allies.'),
    [ID.SNEAK_GYRO]: skillTooltip('Deploy a gyro that conceals nearby allies in a smoke field.'),
    // Function Gyro gains its finisher and control independently.
    [ID.FUNCTION_GYRO]: skillTooltip('Strike your target and create a lightning field.', (context, _skill, build) => [
      ...(tooltipHasTrait(context, build, TRAIT.SYSTEM_SHOCKER)
        ? simulationEffectFacts(tooltipProfile(context, TRAIT.SYSTEM_SHOCKER).effects).facts
        : []),
      ...(tooltipHasTrait(context, build, TRAIT.KINETIC_ACCELERATORS)
        ? [{ name: 'Combo finisher', detail: 'Blast' }]
        : [])
    ])
  },
  traits: {
    [TRAIT.FUNCTION_GYRO]: traitTooltip('Unlock Function Gyro, which can trigger supported gyro and toolbelt traits.'),
    [TRAIT.SPEED_OF_SYNERGY]: traitTooltip(
      'Healing skills and their toolbelt skills grant superspeed. Equipping Med Kit is excluded; its toolbelt uses the longer duration.'
    ),
    [TRAIT.IMPACT_SAVANT]: outsideScopeTooltip,
    [TRAIT.GYROSCOPIC_ACCELERATION]: traitTooltip('Well skills and Function Gyro grant superspeed.'),
    [TRAIT.SYSTEM_SHOCKER]: traitTooltip('Function Gyro dazes your target.'),
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
      'Successful blast, leap, and whirl combos grant quickness and might to the party. Function Gyro becomes a blast finisher. Gain concentration based on power. Bonuses from other attribute conversions do not count.',
      [
        ['internalCooldown', 'Whirl-combo boon cooldown', tooltipSeconds],
        attributeConversionFact('Power', 'Concentration')
      ]
    ),
    [TRAIT.APPLIED_FORCE]: traitTooltip(
      'Might grants additional power. Reaching the might threshold grants stability.',
      [
        ['attributePerStack', 'Additional power per might stack'],
        maximumBonusFact('attributePerStack', 'maximumStacks', 'Maximum additional Power', tooltipDecimal),
        ['threshold', 'Might needed for stability'],
        ['internalCooldown', 'Stability cooldown', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
