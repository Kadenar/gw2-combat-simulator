/** Present heat costs and trait bonuses with their in-game fact icons and selected balance values. */
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipPercent,
  tooltipPercentValue,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips,
  type SimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  armFlipTooltip,
  gleamSaberTooltip,
  heatStrikeFacts,
  heatTiers
} from '#gw2/professions/engineer/app/tooltips/shared.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';

// Heat uses the official thermometer glyph; percentage bonuses use the book glyph.
const HEAT_FACT_ICON = 'https://render.guildwars2.com/file/1BA1F3645206FB4BE92C5AD6326054250DC7D0DB/1770205.png';
const BONUS_FACT_ICON = 'https://render.guildwars2.com/file/9352ED3244417304995F26CB01AE76BB7E547052/156661.png';

/** Heat is authored in percentage points, so its display must not multiply the value by 100. */
const heatPercent = (value: number): string => `${tooltipDecimal(value)}%`;

/** Present each activation-heat variant in its own tab using the selected balance data. */
function heatPacketTooltip(skillId: SkillId, description: string, { field = false } = {}): DescribeSimulationTooltip {
  return (balanceContext, entity) => {
    const skill = requireSkill(balanceContext.catalog, skillId);
    const facts = [
      ...simulationEffectFacts(
        balanceContext.catalog.skillsById
          .get(entity.id)!
          .effects?.filter((effect) => effect.type !== 'custom' && effect.metadata?.trigger !== 'heat-field')
          .map((effect) => (field && effect.type === 'strike' ? { ...effect, name: 'Initial beam' } : effect))
      ).facts
    ];
    const factTabs: NonNullable<SimulationTooltip['factTabs']>[number][] = [];
    const tabLabels = [
      `≤${heatPercent(HOLOSMITH_HEAT.highThreshold)}`,
      `>${heatPercent(HOLOSMITH_HEAT.highThreshold)}`,
      `>${heatPercent(tooltipNumber(tooltipProfile(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT), 'threshold'))} · ECSU`
    ];

    // The low-heat beam has no field; each tab includes the initial strike and launch for a complete tier preview.
    if (field) factTabs.push({ label: tabLabels[0]!, facts: [...facts] });

    for (let tier = field ? 1 : 0; tier < tabLabels.length; tier += 1) {
      const count = tooltipNumber(skill, field ? 'packetCount' : tier === 0 ? 'basePacketCount' : 'highPacketCount');
      const factor = tier === 0 ? 1 : tooltipNumber(skill, tier === 2 ? 'enhancedStrikeFactor' : 'highStrikeFactor');
      const tierFacts = simulationEffectFacts(
        (field
          ? skill.effects!.filter((effect) => effect.metadata?.trigger === 'heat-field')
          : requireSkillAction(skill, 'heat-payload').effects
        ).map((effect): SkillEffect =>
          effect.type === 'strike'
            ? {
                ...effect,
                name: field ? 'Lingering field' : 'Strike',
                coefficient: tooltipNumber(effect, 'coefficient') * count * factor,
                hits: count
              }
            : effect.type === 'condition'
              ? {
                  ...effect,
                  applications: count,
                  duration:
                    tooltipNumber(effect, 'duration') *
                    (field && tier === 2 ? tooltipNumber(skill, 'enhancedConditionBaseDurationFactor') : 1)
                }
              : effect
        )
      ).facts;

      factTabs.push({
        label: tabLabels[tier]!,
        facts: [
          ...facts,
          ...tierFacts,
          ...('packetInterval' in skill
            ? [skillFact(balanceContext, skillId, 'packetInterval', 'Pulse interval', tooltipSeconds)]
            : []),
          // Identify the enhanced tier's required trait using its catalog artwork.
          ...(tier === 2
            ? [
                {
                  name: 'Requires',
                  detail: 'Enhanced Capacity Storage Unit',
                  icon: balanceContext.catalog.traits.find(
                    (trait) => trait.id === TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT
                  )!.icon
                }
              ]
            : [])
        ]
      });
    }

    return { description, facts: [], factTabs };
  };
}

const photonForgeEnterTooltip: DescribeSimulationTooltip = skillTooltip(
  'Replace your weapon skills with Photon Forge attacks. Heat builds over time and when you use Forge skills. At maximum heat, you overheat and can no longer use Forge attacks. Use Deactivate Photon Forge to leave Forge. Kits are briefly unavailable after entering.',
  (balanceContext) => [
    {
      ...profileFact(balanceContext, TRAIT.PHOTON_PROJECTOR, 'energyRegenerationPerSecond', 'Passive heat per second'),
      icon: HEAT_FACT_ICON
    },
    skillFact(
      balanceContext,
      ID.ENGAGE_PHOTON_FORGE,
      'kitLockoutDuration',
      'Kit lockout after Forge entry',
      tooltipSeconds
    ),
    {
      ...profileFact(
        balanceContext,
        TRAIT.LIGHT_DENSITY_AMPLIFIER,
        'resourceGain',
        'Additional heat per second with Light Density Amplifier'
      ),
      icon: HEAT_FACT_ICON
    },
    { name: 'Maximum heat', detail: tooltipDecimal(HOLOSMITH_HEAT.baseMaximum) },
    {
      name: 'Maximum heat with Enhanced Capacity Storage Unit',
      detail: tooltipDecimal(
        tooltipNumber(tooltipProfile(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT), 'maximumStacks')
      )
    }
  ]
);

const photonForgeExitTooltip: DescribeSimulationTooltip = skillTooltip(
  'Leave Photon Forge and return to your weapon skills. After a short delay, heat begins to fall, cooling faster over time. With Photonic Blasting Module, heat only cools after overheating.',
  () => [
    { name: 'Cooling delay', detail: tooltipSeconds(HOLOSMITH_HEAT.coolingDelay) },
    { name: 'Initial cooling per second', detail: tooltipDecimal(HOLOSMITH_HEAT.slowCoolingPerSecond) },
    { name: 'Later cooling per second', detail: tooltipDecimal(HOLOSMITH_HEAT.fastCoolingPerSecond) }
  ]
);

/** Describe the attack itself; the shared heat fact supplies its selected numeric amount. */
const forgeMeleeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike your target with a blade of light. Generates heat.'
);

const forgeProjectileTooltip: DescribeSimulationTooltip = skillTooltip(
  'Fire an explosive projectile at your target. Generates heat.'
);

const coronaBurstHeatTooltip: DescribeSimulationTooltip = skillTooltip(
  'Release a burst that burns your target, applies vulnerability, and grants you might. Generates heat over several pulses, which continue after you leave Photon Forge.'
);

const photonBlitzHeatTooltip: DescribeSimulationTooltip = skillTooltip(
  'Fire a volley of projectiles that burn your target. Each projectile fired generates heat. Ending the channel early fires fewer projectiles and generates less heat.'
);

/** Describe holosmith tooltips from the selected balance data. */
export const holosmithTooltips = {
  // Every heat-generating attack uses the heat glyph; pulsed skills show their total heat.
  skillFacts: (_c, entity) =>
    entity.heatGain == null
      ? []
      : [
          {
            name:
              entity.id === ID.CORONA_BURST || entity.id === ID.PHOTON_BLITZ
                ? 'Total heat generated'
                : 'Heat generated',
            detail: tooltipDecimal(tooltipNumber(entity, 'heatGain')),
            icon: HEAT_FACT_ICON
          }
        ],
  skills: {
    [ID.PHOTON_WALL]: armFlipTooltip,
    [ID.GLEAM_SABER]: gleamSaberTooltip,
    [ID.ENGAGE_PHOTON_FORGE]: photonForgeEnterTooltip,
    ...Object.fromEntries(
      [ID.DEACTIVATE_PHOTON_FORGE, ID.DEACTIVATE_PHOTON_FORGE_HOT].map((id) => [id, photonForgeExitTooltip])
    ),
    ...Object.fromEntries([ID.LIGHT_STRIKE, ID.BRIGHT_SLASH, ID.FLASH_CUTTER].map((id) => [id, forgeMeleeTooltip])),
    ...Object.fromEntries(
      [ID.LIGHT_STRIKE_STORM, ID.BRIGHT_SLASH_STORM, ID.FLASH_CUTTER_STORM].map((id) => [id, forgeProjectileTooltip])
    ),
    [ID.HOLO_LEAP]: skillTooltip(
      'Leap at your target and strike, granting swiftness to yourself and nearby allies. Generates heat.'
    ),
    [ID.HOLOGRAPHIC_SHOCKWAVE]: skillTooltip(
      'Launch your target with a shockwave that always critically strikes. Generates heat.'
    ),
    [ID.CORONA_BURST]: coronaBurstHeatTooltip,
    [ID.PHOTON_BLITZ]: photonBlitzHeatTooltip,
    [ID.LAUNCH_WALL]: heatPacketTooltip(
      ID.LAUNCH_WALL,
      'Launch Photon Wall to strike foes and inflict vulnerability. Heat when activated determines the number of walls and their damage.'
    ),
    [ID.LASER_DISK]: heatPacketTooltip(
      ID.LASER_DISK,
      "Create rotating blades that strike and inflict bleeding. Heat when activated determines the attack's effects."
    ),
    [ID.PRIME_LIGHT_BEAM]: heatPacketTooltip(
      ID.PRIME_LIGHT_BEAM,
      "Fire a beam that launches foes. Above 50% heat, leave a lingering field that strikes and burns foes. Heat when activated determines the field's damage and burning duration.",
      { field: true }
    ),
    [ID.RADIANT_ARC]: (balanceContext, entity) => ({
      description: 'Leap, strike, and gain quickness based on the activation heat tier.',
      facts: [
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(entity.id)!.effects?.filter((effect) => effect.type !== 'custom')
        ).facts,
        ...['baseDuration', 'highDuration', 'enhancedDuration'].flatMap(
          (field, index) =>
            simulationEffectFacts(
              [
                {
                  type: 'boon',
                  boon: BOON.QUICKNESS,
                  duration: tooltipNumber(requireSkill(balanceContext.catalog, ID.RADIANT_ARC), field)
                }
              ],
              heatTiers(balanceContext)[index]
            ).facts
        )
      ]
    }),
    [ID.REFRACTION_CUTTER]: (balanceContext, entity) => ({
      description:
        'Strike and launch the base blade. Activation heat adds further blades, each with its own strike, bleeding, and projectile combo attempt.',
      facts: [
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(entity.id)!.effects?.filter((effect) => effect.type !== 'custom')
        ).facts,
        ...simulationEffectFacts(
          requireSkillAction(requireSkill(balanceContext.catalog, ID.REFRACTION_CUTTER), 'heat-payload').effects,
          'per additional blade'
        ).facts,
        ...['baseExtraBlades', 'highExtraBlades', 'enhancedExtraBlades'].map((field, index) =>
          skillFact(
            balanceContext,
            ID.REFRACTION_CUTTER,
            field,
            `Additional blades ${heatTiers(balanceContext)[index]}`
          )
        )
      ]
    }),
    [ID.SUN_EDGE]: skillTooltip(
      "Strike with your sword. Holosmith's current heat tier increases this strike.",
      (balanceContext) => heatStrikeFacts(balanceContext, ID.SUN_EDGE)
    ),
    [ID.SUN_RIPPER]: skillTooltip(
      "Strike with your sword. Holosmith's current heat tier increases this strike.",
      (balanceContext) => heatStrikeFacts(balanceContext, ID.SUN_RIPPER)
    ),
    [ID.BLADE_BURST]: skillTooltip(
      "Launch blades. Holosmith's heat tier increases their strike damage.",
      (balanceContext) => heatStrikeFacts(balanceContext, ID.BLADE_BURST)
    ),
    [ID.PARTICLE_ACCELERATOR]: skillTooltip(
      "Fire a projectile. Holosmith's heat tier increases its strike damage.",
      (balanceContext) => heatStrikeFacts(balanceContext, ID.PARTICLE_ACCELERATOR)
    )
  },
  traits: {
    [TRAIT.PHOTON_PROJECTOR]: traitTooltip(
      'Unlock Photon Forge, its skill bar, and the heat resource. Heat strengthens eligible skills, with an additional tier from Enhanced Capacity Storage Unit. Delayed attacks retain their activation heat tier.'
    ),
    [TRAIT.HEAT_THERAPY]: outsideScopeTooltip,
    [TRAIT.LASERS_EDGE]: traitTooltip(
      'Heat increases player strike damage in Photon Forge. Photonic Blasting Module retains the bonus while cooling after overheating.',
      (context, id) =>
        [
          profileFact(context, id, 'bonusPerHeat', 'Strike damage per heat', tooltipPercent),
          profileFact(context, id, 'maximumDamageIncrease', 'Normal maximum bonus', tooltipPercent),
          profileFact(
            context,
            TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
            'maximumDamageIncrease',
            'Enhanced Capacity maximum bonus',
            tooltipPercent
          )
        ].map((fact) => ({ ...fact, icon: BONUS_FACT_ICON }))
    ),
    [TRAIT.LIGHT_DENSITY_AMPLIFIER]: traitTooltip(
      'Photon Forge passively generates additional heat.',
      (context, id) => [
        { ...profileFact(context, id, 'resourceGain', 'Bonus heat per second', heatPercent), icon: HEAT_FACT_ICON }
      ]
    ),
    [TRAIT.PRISMATIC_CONVERTER]: outsideScopeTooltip,
    [TRAIT.SOLAR_FOCUSING_LENS]: traitTooltip(
      'Photon Forge transitions grant charges that empower subsequent eligible strikes and inflict burning. High-heat transitions grant more charges.',
      (context, id) => [
        profileFact(context, id, 'minimumStacks', 'Base charges'),
        profileFact(context, id, 'maximumStacks', 'High-heat charges'),
        {
          ...profileFact(context, id, 'duration', 'Charge window', tooltipSeconds),
          icon: MODIFIER_EFFECT_ICONS.Interval
        },
        profileFact(context, id, 'damageIncrease', 'Empowered strike damage', tooltipPercent)
      ]
    ),
    [TRAIT.CRYSTAL_CONFIGURATION_STORM]: traitTooltip(
      'Photon Forge autoattacks fire explosive projectiles but generate additional heat.',
      (context) => {
        // Read the replacement's mechanics so trait facts follow the selected skill balance.
        const storm = requireSkill(context.catalog, ID.LIGHT_STRIKE_STORM);
        const melee = requireSkill(context.catalog, ID.LIGHT_STRIKE);
        return [
          {
            name: 'Additional heat gained',
            detail: heatPercent(tooltipNumber(storm, 'heatGain') - tooltipNumber(melee, 'heatGain')),
            icon: HEAT_FACT_ICON
          },
          ...(storm.comboFinishers || []).map((finisher) => ({
            name: 'Combo finisher',
            detail: `${finisher.finisherType} · ${tooltipPercentValue(tooltipNumber(finisher, 'chance'))} chance`
          }))
        ];
      }
    ),
    [TRAIT.CRYSTAL_CONFIGURATION_ECLIPSE]: outsideScopeTooltip,
    [TRAIT.CRYSTAL_CONFIGURATION_ZEPHYR]: outsideScopeTooltip,
    [TRAIT.THERMAL_RELEASE_VALVE]: traitTooltip(
      'Dodging grants vigor. While you have heat to spend, it also triggers Vent Exhaust, losing heat and striking and burning nearby foes.',
      (context) => [
        { ...skillFact(context, ID.VENT_EXHAUST, 'heatLoss', 'Heat lost', heatPercent), icon: HEAT_FACT_ICON },
        // The description identifies the single invoked skill; its effect rows need no repeated source labels.
        ...simulationEffectFacts(
          requireSkill(context.catalog, ID.VENT_EXHAUST).effects?.map((effect) => ({ ...effect, name: undefined }))
        ).facts
      ]
    ),
    [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]: traitTooltip(
      'Raise the heat limit, unlock enhanced heat tiers on supported skills, and periodically gain might at high heat.',
      [
        ['pulseInterval', 'Might pulse interval', tooltipSeconds],
        fromProfile(
          TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
          'maximumDamageIncrease',
          "Maximum Laser's Edge strike bonus",
          tooltipPercent
        )
      ]
    ),
    [TRAIT.PHOTONIC_BLASTING_MODULE]: traitTooltip(
      "When you overheat, explode to strike and burn nearby foes. Heat is retained after leaving Photon Forge and only dissipates after overheating. Laser's Edge continues to grant bonus damage as you cool.",
      [['cooldown', 'Overheat recharge', tooltipSeconds]]
    )
  }
} satisfies ProfessionTooltips<HolosmithSkill>;
