import {
  fromProfile,
  outsideScopeTooltip,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as DRAGONHUNTER } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { virtueTooltip } from '#gw2/professions/guardian/app/tooltips/shared.js';

const dragonhunterJusticeTooltip: DescribeSimulationTooltip = skillTooltip(
  "Strike and tether your target, applying recurring Burning while the tether remains active. Hunter's Verdict ends the tether early; Big Game Hunter extends it.",
  (balanceContext) => [
    ...simulationEffectFacts(
      tooltipProfile(balanceContext, DRAGONHUNTER.tether).effects?.filter((effect) => effect.packetLabel !== 'passive'),
      'per tether pulse'
    ).facts
  ]
);

const dragonhunterVirtueTooltip: DescribeSimulationTooltip = skillTooltip(
  'Activate Wings of Resolve and its virtue traits. Soaring Devastation adds its strike and immobilize. Healing is outside combat simulation scope.'
);

const huntersVerdictTooltip: DescribeSimulationTooltip = skillTooltip(
  'Break the active Spear of Justice tether and pull your target. Ending the tether cancels its remaining pulses.'
);

/** Describe dragonhunter tooltips from the selected balance data. */
export const dragonhunterTooltips = {
  skills: {
    [ID.SPEAR_OF_JUSTICE]: dragonhunterJusticeTooltip,
    [ID.WINGS_OF_RESOLVE]: dragonhunterVirtueTooltip,
    [ID.HUNTERS_VERDICT]: huntersVerdictTooltip,
    [ID.SHIELD_OF_COURAGE]: virtueTooltip
  },
  traits: {
    [TRAIT.VIRTUOUS_ACTION]: traitTooltip(
      'Replace the core virtues with Spear of Justice, Wings of Resolve, and Shield of Courage.'
    ),
    [TRAIT.DEFENDERS_DOGMA]: traitTooltip('Gain vitality.', [['attributeBonus', 'Vitality']]),
    [TRAIT.PURE_OF_SIGHT]: traitTooltip(
      "Deal increased strike damage within the simulator's fixed positioning assumptions.",
      [fromProfile(TRAIT.PURE_OF_SIGHT, 'damageMultiplier', 'Strike damage', tooltipFactorChange)]
    ),
    [TRAIT.HUNTERS_PREMONITION]: traitTooltip('Using a trap grants aegis.'),
    [TRAIT.DULLED_SENSES]: traitTooltip('Applying player control effects inflicts crippled.'),
    [TRAIT.SOARING_DEVASTATION]: traitTooltip('Wings of Resolve strikes and immobilizes the target.'),
    [TRAIT.HUNTERS_DETERMINATION]: traitTooltip('Using an elite skill restores endurance.', [
      ['resourceGain', 'Endurance restored']
    ]),
    [TRAIT.ZEALOTS_AGGRESSION]: traitTooltip('Deal increased strike damage to crippled targets.', [
      fromProfile(
        TRAIT.ZEALOTS_AGGRESSION,
        'damageMultiplier',
        'Strike damage against crippled targets',
        tooltipFactorChange
      )
    ]),
    [TRAIT.BULWARK]: outsideScopeTooltip,
    [TRAIT.HUNTERS_FORTIFICATION]: outsideScopeTooltip,
    [TRAIT.HEAVY_LIGHT]: traitTooltip(
      'Control effects grant stability. Deal increased strike damage to disabled or defiant targets.',
      [
        fromProfile(
          TRAIT.HEAVY_LIGHT,
          'damageMultiplier',
          'Strike damage against disabled targets',
          tooltipFactorChange
        ),
        ['internalCooldown', 'Stability cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.BIG_GAME_HUNTER]: traitTooltip(
      'Spear of Justice keeps its tether longer. Strikes during the tether apply vulnerability and deal increased damage.',
      [
        ['pulseInterval', 'Tether duration', tooltipSeconds],
        fromProfile(TRAIT.BIG_GAME_HUNTER, 'damageMultiplier', 'Strike damage while tethered', tooltipFactorChange)
      ]
    )
  }
} satisfies ProfessionTooltips;
