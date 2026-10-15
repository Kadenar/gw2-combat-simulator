import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as DRUID } from '#gw2/professions/ranger/specializations/druid/profiles.js';

/** Compose druid descriptions using the selected catalog's balance data. */
export const druidTooltips = {
  skills: {
    [ID.CELESTIAL_AVATAR]: skillTooltip(
      'Enter Celestial Avatar and replace your weapon bar. Astral force drains until you leave or it is depleted. Entry triggers applicable Avatar and weapon-swap effects.',
      [
        fromProfile(DRUID.resources, 'duration', 'Maximum Avatar duration from full force', tooltipSeconds),
        fromProfile(DRUID.resources, 'maximumStacks', 'Full astral force')
      ]
    ),
    [ID.RELEASE_CELESTIAL_AVATAR]: skillTooltip(
      'Leave Celestial Avatar and restore your weapon skills. Retain part of your remaining astral force; automatic exit from exhaustion retains none. Trigger applicable exit and weapon-swap effects.',
      [
        fromProfile(
          DRUID.resources,
          'astralForceRetentionMultiplier',
          'Remaining astral force retained',
          (value) => `${tooltipDecimal(value * 100)}%`
        )
      ]
    ),
    ...Object.fromEntries(
      [ID.COSMIC_RAY, ID.SEED_OF_LIFE, ID.LUNAR_IMPACT, ID.REJUVENATING_TIDES, ID.NATURAL_CONVERGENCE].map((id) => [
        id,
        skillTooltip(
          'Use this skill while Celestial Avatar is active. Apply its direct effects and eligible Eclipse or Grace of the Land effects. Healing is outside combat simulation scope.'
        )
      ])
    )
  },
  traits: {
    [TRAIT.CELESTIAL_BEING]: traitTooltip(
      'Unlock Druid, staff, glyphs, and Celestial Avatar. Build astral force outside Avatar and spend it to use Avatar skills.'
    ),
    [TRAIT.LIVE_VICARIOUSLY]: outsideScopeTooltip,
    [TRAIT.NATURAL_MENDER]: traitTooltip('Periodically generate astral force outside Celestial Avatar.', [
      ['pulseInterval', 'Interval', tooltipSeconds],
      ['resourceGain', 'Astral force per interval']
    ]),
    [TRAIT.DRUIDIC_CLARITY]: outsideScopeTooltip,
    [TRAIT.VERDANT_ETCHING]: outsideScopeTooltip,
    [TRAIT.BLOOD_MOON]: traitTooltip('Qualifying control and immobilize effects inflict bleeding.'),
    [TRAIT.CELESTIAL_SHADOW]: outsideScopeTooltip,
    [TRAIT.GRACE_OF_THE_LAND]: traitTooltip(
      'Celestial Avatar skills grant alacrity to yourself. Natural Convergence grants it once per completed pulse.',
      () => [],
      'per skill / completed Convergence pulse'
    ),
    [TRAIT.NATURAL_BALANCE]: traitTooltip(
      'Entering or leaving Celestial Avatar temporarily increases your condition damage and condition duration.',
      [
        ['conditionDamageIncrease', 'Condition damage', tooltipPercent],
        ['conditionDurationBonus', 'Condition duration', tooltipPercent]
      ]
    ),
    [TRAIT.CULTIVATED_SYNERGY]: outsideScopeTooltip,
    [TRAIT.LINGERING_LIGHT]: outsideScopeTooltip,
    [TRAIT.ECLIPSE]: (balanceContext, entity) => ({
      description:
        'Celestial Avatar skills apply their corresponding conditions. Gain additional astral force from damage outside Avatar.',
      facts: [
        profileFact(
          balanceContext,
          'ranger.druid.resources',
          'coefficientMultiplier',
          'Damage-generated astral force',
          (value) => `${tooltipDecimal(value)}×`
        ),
        ...(tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
          (effect, index) =>
            simulationEffectFacts(
              [{ ...effect, applications: index === 4 ? 3 : 1 }],
              [
                'Cosmic Ray',
                'Seed of Life',
                'Lunar Impact',
                'Rejuvenating Tides',
                'Natural Convergence early pulses',
                'Natural Convergence final pulse'
              ][index]
            ).facts
        )
      ]
    })
  }
} satisfies ProfessionTooltips;
