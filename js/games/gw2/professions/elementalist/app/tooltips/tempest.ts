import {
  fromProfile,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import {
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { TEMPEST_BALANCE_PROFILE_IDS as TEMPEST } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** Describe tempest tooltips from the selected balance data. */
export const tempestTooltips = {
  skills: {
    ...Object.fromEntries(
      [ID.WASH_THE_PAIN_AWAY, ID.FEEL_THE_BURN, ID.AFTERSHOCK].map((id) => [
        id,
        skillTooltip(
          "Apply this shout's effects and trigger applicable shout and aura traits. Tempestuous Aria adds party might."
        )
      ])
    ),
    ...Object.fromEntries(
      Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS).map((id) => [
        id,
        skillTooltip(
          'Channel the current attunement after its overload has become available. Apply its pulses and eligible overload traits; leaving this attunement afterward incurs its overload recharge. Fire, Air, and Earth overloads fully charge active spear etchings. Air completion adds Lightning Jolt and arms a copy on the active elemental.',
          (balanceContext) => [
            profileFact(
              balanceContext,
              TEMPEST.overloads,
              'initialDelay',
              'Base time in attunement before overload',
              tooltipSeconds
            ),
            ...(id === ID.OVERLOAD_AIR
              ? simulationEffectFacts(
                  tooltipProfile(balanceContext, TEMPEST.lightningJolt).effects?.map((effect) => ({
                    ...effect,
                    canCrit: false
                  })),
                  'additional completion strike; also copied by an active elemental'
                ).facts
              : [])
          ]
        )
      ])
    )
  },
  traits: {
    [TRAIT.SINGULARITY]: traitTooltip(
      'Unlock Tempest, warhorn, shouts, and overloads. Holding an attunement forms its singularity, making its overload available.'
    ),
    [TRAIT.GATHERED_FOCUS]: traitTooltip('Gain concentration.', [['attributeBonus', 'Concentration']]),
    [TRAIT.HARDY_CONDUIT]: traitTooltip('Beginning an overload grants protection.'),
    [TRAIT.GALE_SONG]: traitTooltip('Completing a healing skill grants protection.'),
    [TRAIT.LATENT_STAMINA]: traitTooltip('Entering Water grants vigor.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.UNSTABLE_CONDUIT]: traitTooltip('Completing an overload grants the aura corresponding to its attunement.'),
    [TRAIT.TEMPESTUOUS_ARIA]: traitTooltip(
      'Completing a shout grants might to the party. Gaining an aura starts or extends a temporary strike- and condition-damage bonus.',
      [
        fromProfile(TRAIT.TEMPESTUOUS_ARIA, 'damageIncrease', 'Strike damage during bonus', tooltipPercent),
        fromProfile(TRAIT.TEMPESTUOUS_ARIA, 'conditionDamageIncrease', 'Condition damage during bonus', tooltipPercent),
        ['durationExtension', 'Bonus duration added per aura', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining bonus duration', tooltipSeconds]
      ],
      'shout might to party'
    ),
    [TRAIT.HARMONIOUS_CONDUIT]: traitTooltip('Beginning an overload grants swiftness and stability.'),
    [TRAIT.INVIGORATING_TORRENTS]: traitTooltip('Gaining an aura grants vigor and regeneration.'),
    [TRAIT.TRANSCENDENT_TEMPEST]: traitTooltip(
      'Singularities form sooner. Completing an overload grants a temporary strike- and condition-damage bonus.',
      [
        fromProfile(TEMPEST.overloads, 'duration', 'Base attunement dwell', tooltipSeconds),
        fromProfile(TRAIT.TRANSCENDENT_TEMPEST, 'damageIncrease', 'Strike damage', tooltipPercent),
        fromProfile(TRAIT.TRANSCENDENT_TEMPEST, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)
      ]
    ),
    [TRAIT.LUCID_SINGULARITY]: traitTooltip(
      'The first eligible overload hits grant alacrity to yourself. The last emitted hit within the limit uses the longer application, including when interrupted.',
      [['maximumStacks', 'Maximum alacrity applications']]
    ),
    [TRAIT.ELEMENTAL_BASTION]: traitTooltip(
      'Gaining an aura grants alacrity. Healing is outside combat simulation scope.'
    )
  }
} satisfies ProfessionTooltips;
