import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as GALESHOT } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';

/** Compose galeshot descriptions using the selected catalog's balance data. */
export const galeshotTooltips = {
  skillFacts: (_balanceContext, entity) => [
    ...[
      ['arrowCost', 'Arrows spent'],
      ['windForceGain', 'Wind Force gained'],
      ['arrowsRestored', 'Arrows restored']
    ].flatMap(([field, name]) =>
      entity[field] == null ? [] : [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
    )
  ],
  skills: {
    [ID.SUMMON_CYCLONE_BOW]: skillTooltip(
      'Equip the Cyclone Bow and replace your weapon skills. Trigger applicable weapon-swap effects. Arrows regenerate over time and are shared across its skills.',
      [
        fromProfile(GALESHOT.resources, 'maximumStacks', 'Arrow capacity'),
        fromProfile(GALESHOT.resources, 'pulseInterval', 'Base arrow regeneration interval', tooltipSeconds)
      ]
    ),
    [ID.DISMISS_CYCLONE_BOW]: skillTooltip(
      'Dismiss the Cyclone Bow, clear Wind Force, and restore your weapon skills. Trigger applicable weapon-swap effects.'
    ),
    ...Object.fromEntries(
      [ID.HAWKEYE, ID.BLUSTER, ID.FLEETING_ZEPHYR, ID.QUARRYS_PERIL, ID.PELT, ID.SUPERSONIC_ARROW].map((id) => [
        id,
        skillTooltip(
          'Use this Cyclone Bow skill, spend its arrows, and gain the listed Wind Force. Apply eligible Cyclone Bow traits.'
        )
      ])
    ),
    ...Object.fromEntries(
      [ID.PERFECT_STORM, ID.PIERCING_GALES].map((id) => [
        id,
        skillTooltip("Apply this skill's effects and restore Cyclone Bow arrows up to their capacity.")
      ])
    ),
    [ID.MISTRAL]: skillTooltip(
      'Restore arrows and arm Mistral. Each eligible missile hit during its window adds a strike and Chilled.',
      (balanceContext) => [
        profileFact(balanceContext, GALESHOT.mistral, 'duration', 'Mistral window', tooltipSeconds),
        ...simulationEffectFacts(tooltipProfile(balanceContext, GALESHOT.mistral).effects, 'per eligible missile hit')
          .facts
      ]
    ),
    [ID.HAWKEYE]: skillTooltip(
      'At full Wind Force, replace Keen Shot with this empowered attack. Consume all Wind Force and the listed arrows, then trigger eligible Gale Force and Cloudburst effects.',
      [fromProfile(GALESHOT.resources, 'minimumStacks', 'Wind Force required and consumed')]
    ),
    [ID.KEEN_SHOT]: skillTooltip(
      "Fire the Cyclone Bow's basic arrow. At full Wind Force, Hawkeye replaces this skill."
    ),
    [ID.BLUSTER]: skillTooltip(
      "Fire the Cyclone Bow attack and gain Wind Force. With Wuthering Wind, arm the active pet's next eligible hit for an additional strike. Cloudburst can grant party boons."
    ),
    [ID.QUARRYS_PERIL]: skillTooltip(
      "Fire the Cyclone Bow attack, spend arrows, and gain Wind Force. Cloudburst resets Bluster's recharge; Perilous Skies replaces this skill with Pelt."
    ),
    [ID.SUPERSONIC_ARROW]: skillTooltip(
      "Fire the Cyclone Bow attack, spend arrows, and gain Wind Force. Cloudburst resets Bluster's recharge when selected."
    )
  },
  traits: {
    [TRAIT.TEACHINGS_OF_THE_TENGU]: traitTooltip(
      'Unlock Galeshot, gust skills, and Cyclone Bow. Generate wind force and spend wind arrows on Cyclone Bow attacks.'
    ),
    [TRAIT.BIRD_OF_PREY]: traitTooltip('Your strikes deal increased damage while swiftness or superspeed is active.', [
      fromProfile(TRAIT.BIRD_OF_PREY, 'damageIncrease', 'Strike damage', tooltipPercent)
    ]),
    [TRAIT.JETSTREAM]: outsideScopeTooltip,
    [TRAIT.JOY_OF_MOVEMENT]: outsideScopeTooltip,
    [TRAIT.FEEL_THE_RUSH]: outsideScopeTooltip,
    [TRAIT.WUTHERING_WIND]: traitTooltip(
      "Bluster prepares the pet's next qualifying strike to trigger Wuthering Wind. Its damage uses pet power scaling."
    ),
    [TRAIT.FLOCK_TOGETHER]: traitTooltip(
      'Feathered pets deal increased strike damage. Using a beast skill grants quickness to the party.',
      [
        fromProfile(TRAIT.FLOCK_TOGETHER, 'damageMultiplier', 'Feathered pet strike damage', tooltipFactorChange),
        ['internalCooldown', 'Quickness cooldown', tooltipSeconds]
      ],
      RECIPIENT.PARTY
    ),
    [TRAIT.PERILOUS_SKIES]: traitTooltip("Replace Quarry's Peril with Pelt while using Cyclone Bow."),
    [TRAIT.THRILL_OF_THE_CATCH]: traitTooltip('Player or pet control effects restore wind arrows.', [
      ['resourceGain', 'Wind arrows restored'],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.CLOUDBURST]: (balanceContext, entity) => ({
      description:
        "Bluster and Hawkeye grant their corresponding party boons. Quarry's Peril and Supersonic Arrow reset Bluster's recharge.",
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap(
        (effect, index) => simulationEffectFacts([effect], index < 2 ? 'Bluster · party' : 'Hawkeye · party').facts
      )
    }),
    [TRAIT.GALE_FORCE]: traitTooltip(
      'Wind Force increases your strike damage. Hawkeye grants an additional temporary damage bonus; wind force gained during that bonus still contributes.',
      [
        fromProfile(TRAIT.GALE_FORCE, 'damageIncreasePerStack', 'Strike damage per Wind Force stack', tooltipPercent),
        fromProfile(TRAIT.GALE_FORCE, 'damageIncrease', 'Additional strike damage after Hawkeye', tooltipPercent)
      ]
    ),
    [TRAIT.SHRIKE]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      return {
        description: 'After enough qualifying missile hits, restore a wind arrow and fire additional strikes.',
        facts: [
          profileFact(balanceContext, entity.id, 'threshold', 'Missile hits required'),
          profileFact(balanceContext, entity.id, 'resourceGain', 'Wind arrows restored'),
          ...simulationEffectFacts(
            (profile.effects || []).map((effect) =>
              effect.type === 'strike'
                ? { ...effect, coefficient: tooltipNumber(effect, 'coefficient') * tooltipNumber(effect, 'hits') }
                : effect
            )
          ).facts
        ]
      };
    }
  }
} satisfies ProfessionTooltips;
