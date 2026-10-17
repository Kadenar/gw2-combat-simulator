import { BOON } from '#gw2/platform/effects/boons.js';
import {
  fromProfile,
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
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as HOLOSMITH } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  heatTiers,
  heatStrikeFacts,
  armFlipTooltip,
  gleamSaberTooltip
} from '#gw2/professions/engineer/app/tooltips/shared.js';

/** Heat variants describe mutually exclusive packets without evaluating a live combat context. */
function heatPacketTooltip(profileId: SkillId, description: string, field = false): DescribeSimulationTooltip {
  return (balanceContext, entity) => {
    const profile = tooltipProfile(balanceContext, profileId);
    const facts = [
      ...simulationEffectFacts(
        balanceContext.catalog.skillsById.get(entity.id)!.effects?.filter((effect) => effect.type !== 'custom')
      ).facts
    ];
    for (let tier = field ? 1 : 0; tier < heatTiers(balanceContext).length; tier += 1) {
      const count = tooltipNumber(profile, field ? 'packetCount' : tier === 0 ? 'basePacketCount' : 'highPacketCount');
      const factor = tier === 2 ? tooltipNumber(profile, 'enhancedStrikeFactor') : 1;
      facts.push(
        ...simulationEffectFacts(
          profile.effects?.map((effect): SkillEffect =>
            effect.type === 'strike'
              ? { ...effect, coefficient: tooltipNumber(effect, 'coefficient') * count * factor, hits: count }
              : effect.type === 'condition'
                ? {
                    ...effect,
                    applications: count,
                    duration:
                      tooltipNumber(effect, 'duration') *
                      (field && tier === 2 ? tooltipNumber(profile, 'enhancedConditionBaseDurationFactor') : 1)
                  }
                : effect
          ),
          heatTiers(balanceContext)[tier]
        ).facts
      );
    }

    if (profile.packetInterval != null)
      facts.push(profileFact(balanceContext, profileId, 'packetInterval', 'Pulse interval', tooltipSeconds));

    return { description, facts };
  };
}

const photonForgeEnterTooltip: DescribeSimulationTooltip = skillTooltip(
  'Enter Photon Forge, replace the weapon bar, and begin generating heat. Kits are briefly locked. Reaching maximum heat locks Forge attacks and starts overheat consequences; the rotation must still select the exit action. Applicable Forge-entry traits activate.',
  (balanceContext) => [
    profileFact(balanceContext, HOLOSMITH.heat, 'energyRegenerationPerSecond', 'Passive heat per second'),
    profileFact(
      balanceContext,
      TRAIT.LIGHT_DENSITY_AMPLIFIER,
      'resourceGain',
      'Additional heat per second with Light Density Amplifier'
    ),
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
  'Leave Photon Forge and restore the weapon bar. Cooling begins after its delay and accelerates later. Photonic Blasting Module prevents cooling from ordinary exit; overheating still enables cooling. Forge-exit and bar-swap traits apply.',
  (balanceContext) => [
    profileFact(balanceContext, HOLOSMITH.heat, 'cooldown', 'Base Forge re-entry cooldown', tooltipSeconds),
    { name: 'Cooling delay', detail: tooltipSeconds(HOLOSMITH_HEAT.coolingDelay) },
    { name: 'Initial cooling per second', detail: tooltipDecimal(HOLOSMITH_HEAT.slowCoolingPerSecond) },
    { name: 'Later cooling per second', detail: tooltipDecimal(HOLOSMITH_HEAT.fastCoolingPerSecond) }
  ]
);

const heatTooltip: DescribeSimulationTooltip = skillTooltip(
  'Use this Photon Forge attack and generate its heat on completion or a committed interruption.'
);

const coronaBurstHeatTooltip: DescribeSimulationTooltip = skillTooltip(
  "Emit the burst's pulses and generate heat per pulse. Once committed, scheduled heat pulses continue after leaving Photon Forge."
);

const photonBlitzHeatTooltip: DescribeSimulationTooltip = skillTooltip(
  'Fire the channelled projectiles. Heat follows projectiles launched before the channel ends; interruption prevents later launches.'
);

/** Describe holosmith tooltips from the selected balance data. */
export const holosmithTooltips = {
  skillFacts: (_c, entity) =>
    entity.heatGain == null
      ? []
      : [{ name: 'Heat generated by a full activation', detail: tooltipDecimal(tooltipNumber(entity, 'heatGain')) }],
  skills: {
    [ID.PHOTON_WALL]: armFlipTooltip,
    [ID.GLEAM_SABER]: gleamSaberTooltip,
    [ID.ENGAGE_PHOTON_FORGE]: photonForgeEnterTooltip,
    ...Object.fromEntries(
      [ID.DEACTIVATE_PHOTON_FORGE, ID.DEACTIVATE_PHOTON_FORGE_HOT].map((id) => [id, photonForgeExitTooltip])
    ),
    ...Object.fromEntries(
      [
        ID.FLASH_CUTTER_STORM,
        ID.BRIGHT_SLASH_STORM,
        ID.HOLOGRAPHIC_SHOCKWAVE,
        ID.HOLO_LEAP,
        ID.LIGHT_STRIKE_STORM,
        ID.LIGHT_STRIKE,
        ID.BRIGHT_SLASH,
        ID.FLASH_CUTTER
      ].map((id) => [id, heatTooltip])
    ),
    [ID.CORONA_BURST]: coronaBurstHeatTooltip,
    [ID.PHOTON_BLITZ]: photonBlitzHeatTooltip,
    [ID.LAUNCH_WALL]: heatPacketTooltip(
      HOLOSMITH.launchWallHeatTier,
      "Consume Photon Wall's follow-up and launch the heat-tier-selected walls. All walls arrive together; each owns its explosion and vulnerability application."
    ),
    [ID.LASER_DISK]: heatPacketTooltip(
      HOLOSMITH.laserDiskHeatTier,
      'Create rotating blades. Activation heat determines the pulse count and enhanced damage; later heat changes do not alter the sequence.'
    ),
    [ID.PRIME_LIGHT_BEAM]: heatPacketTooltip(
      HOLOSMITH.primeLightBeamHeatTier,
      'Fire the initial beam. Above the heat threshold, also create the damaging field. The activation heat tier determines every delayed field pulse.',
      true
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
                  duration: tooltipNumber(tooltipProfile(balanceContext, HOLOSMITH.radiantArcHeatTier), field)
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
          tooltipProfile(balanceContext, HOLOSMITH.refractionCutterHeatTier).effects,
          'per additional blade'
        ).facts,
        ...['baseExtraBlades', 'highExtraBlades', 'enhancedExtraBlades'].map((field, index) =>
          profileFact(
            balanceContext,
            HOLOSMITH.refractionCutterHeatTier,
            field,
            `Additional blades ${heatTiers(balanceContext)[index]}`
          )
        )
      ]
    }),
    [ID.SUN_EDGE]: skillTooltip(
      "Strike with your sword. Holosmith's current heat tier increases this strike.",
      (balanceContext) => heatStrikeFacts(balanceContext, HOLOSMITH.swordHeatTier)
    ),
    [ID.SUN_RIPPER]: skillTooltip(
      "Strike with your sword. Holosmith's current heat tier increases this strike.",
      (balanceContext) => heatStrikeFacts(balanceContext, HOLOSMITH.swordHeatTier)
    ),
    [ID.BLADE_BURST]: skillTooltip(
      "Launch blades. Holosmith's heat tier increases their strike damage.",
      (balanceContext) => heatStrikeFacts(balanceContext, HOLOSMITH.bladeBurstHeatTier)
    ),
    [ID.PARTICLE_ACCELERATOR]: skillTooltip(
      "Fire a projectile. Holosmith's heat tier increases its strike damage.",
      (balanceContext) => heatStrikeFacts(balanceContext, HOLOSMITH.particleAcceleratorHeatTier)
    )
  },
  traits: {
    [TRAIT.PHOTON_PROJECTOR]: traitTooltip('Unlock Photon Forge, its skill bar, and the heat resource.'),
    [TRAIT.HEAT_THERAPY]: outsideScopeTooltip,
    [TRAIT.LASERS_EDGE]: traitTooltip(
      'Heat increases player strike damage in Photon Forge. Photonic Blasting Module retains the bonus while cooling after overheating.',
      [
        fromProfile(TRAIT.LASERS_EDGE, 'bonusPerHeat', 'Strike damage per heat', tooltipPercent),
        fromProfile(TRAIT.LASERS_EDGE, 'maximumDamageIncrease', 'Normal maximum bonus', tooltipPercent),
        fromProfile(
          TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
          'maximumDamageIncrease',
          'Enhanced Capacity maximum bonus',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.LIGHT_DENSITY_AMPLIFIER]: traitTooltip('Photon Forge passively generates additional heat.', [
      fromProfile(TRAIT.LIGHT_DENSITY_AMPLIFIER, 'resourceGain', 'Additional heat per second')
    ]),
    [TRAIT.PRISMATIC_CONVERTER]: outsideScopeTooltip,
    [TRAIT.SOLAR_FOCUSING_LENS]: traitTooltip(
      'Photon Forge transitions grant charges that empower subsequent eligible strikes and inflict burning. High-heat transitions grant more charges.',
      [
        ['minimumStacks', 'Base charges'],
        ['maximumStacks', 'High-heat charges'],
        ['durationMultiplier', 'Charge window', tooltipSeconds],
        fromProfile(TRAIT.SOLAR_FOCUSING_LENS, 'damageIncrease', 'Empowered strike damage', tooltipPercent)
      ]
    ),
    [TRAIT.CRYSTAL_CONFIGURATION_STORM]: traitTooltip(
      "Replace Photon Forge's autoattack chain with its Storm projectile variants."
    ),
    [TRAIT.CRYSTAL_CONFIGURATION_ECLIPSE]: outsideScopeTooltip,
    [TRAIT.CRYSTAL_CONFIGURATION_ZEPHYR]: outsideScopeTooltip,
    [TRAIT.THERMAL_RELEASE_VALVE]: traitTooltip(
      'Dodging grants vigor and invokes Vent Exhaust when heat can be spent. Photonic Blasting Module prevents venting before its overheat explosion.'
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
      "Overheating triggers a delayed explosion and burning. Cooling occurs only after overheating; Laser's Edge remains active while heat remains.",
      [
        ['initialDelay', 'Explosion delay', tooltipSeconds],
        ['cooldown', 'Overheat recharge', tooltipSeconds]
      ]
    )
  }
} satisfies ProfessionTooltips;
