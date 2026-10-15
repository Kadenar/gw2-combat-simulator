import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  tooltipSeconds,
  skillTooltip,
  profileTooltip,
  profileFact,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/engineer/core/profiles.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { armFlipTooltip, gleamSaberTooltip } from '#gw2/professions/engineer/app/tooltips/shared.js';
import { engineerExplosivesTooltips } from '#gw2/professions/engineer/app/tooltips/explosives.js';
import { engineerToolsTooltips } from '#gw2/professions/engineer/app/tooltips/tools.js';
import { engineerAlchemyTooltips } from '#gw2/professions/engineer/app/tooltips/alchemy.js';
import { engineerFirearmsTooltips } from '#gw2/professions/engineer/app/tooltips/firearms.js';
import { engineerInventionsTooltips } from '#gw2/professions/engineer/app/tooltips/inventions.js';

const kitEquipTooltip: DescribeSimulationTooltip = skillTooltip(
  'Equip this kit, replacing the weapon bar. Kit transitions trigger supported swap and kit-equip traits.'
);

const kitStowTooltip: DescribeSimulationTooltip = skillTooltip(
  'Stow the active kit and return to the equipped weapon bar. Supported bar-swap effects apply.'
);

const consumeFlipTooltip: DescribeSimulationTooltip = skillTooltip(
  'Use and consume the follow-up unlocked by its parent skill.'
);

const mineFieldTooltip: DescribeSimulationTooltip = skillTooltip(
  'Place mines that detonate together. When cast before an explicit combat start, detonation waits for combat. Detonation counts as a second tool-belt activation for supported traits.'
);

const dodgeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Spend endurance to dodge and refresh Explosive Entrance. Power Wrench and Adrenal Implant reduce their supported skill recharges. Thermal Release Valve triggers Vent Exhaust while in Photon Forge.',
  (balanceContext) => [
    profileFact(balanceContext, CORE.resources, 'resourceCost', 'Endurance cost'),
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.VENT_EXHAUST)?.effects,
      'requires Thermal Release Valve and active Photon Forge'
    ).facts
  ]
);

const conduitSurgeTooltip: DescribeSimulationTooltip = profileTooltip(
  CORE.conduitSurge,
  'Strike and burn the target, establishing Focused for subsequent spear attacks. Refreshing Focused preserves a longer existing window.',
  [['durationMultiplier', 'Focused duration', tooltipSeconds]]
);

const lightningRodTooltip: DescribeSimulationTooltip = (balanceContext) => ({
  description:
    'Start a repeating strike sequence that builds charges and later unlocks Electric Artillery. Each pulse checks whether the target is Focused. Recasting replaces the sequence and clears previous charges.',
  facts: [CORE.lightningRod, CORE.focusedLightningRod].flatMap(
    (id) =>
      simulationEffectFacts(
        tooltipProfile(balanceContext, id).effects,
        id === CORE.lightningRod ? 'per pulse without Focused' : 'per pulse while Focused'
      ).facts
  )
});

const electricArtilleryTooltip: DescribeSimulationTooltip = (balanceContext) => ({
  description:
    "Release the projectile and consume Lightning Rod's unexpired charges and follow-up. Charges are snapshotted on release; Focused is checked at impact. Charges extend burning and determine vulnerability stacks. Vulnerability duration is fixed.",
  facts: [CORE.electricArtillery, CORE.focusedElectricArtillery].flatMap((id) => {
    const qualifier = id === CORE.electricArtillery ? 'without Focused' : 'while Focused';
    const profile = tooltipProfile(balanceContext, id);
    return [
      ...profile.effects!.flatMap(
        (effect) =>
          simulationEffectFacts(
            [effect],
            `${qualifier}${effect.type === 'condition' && effect.condition === 'Vulnerability' ? ' · per complete charge group' : effect.type === 'condition' && effect.condition === 'Burning' ? ' · base duration before charges' : ''}`
          ).facts
      ),
      profileFact(balanceContext, id, 'maximumStacks', `Maximum charges counted ${qualifier}`),
      profileFact(balanceContext, id, 'chargesPerVulnerability', `Charges per vulnerability group ${qualifier}`),
      profileFact(
        balanceContext,
        id,
        'burningDurationPerCharge',
        `Burning duration added per charge ${qualifier}`,
        tooltipSeconds
      )
    ];
  })
});

const roilingSkiesTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and cripple the target. Also stun it, or launch it instead while Focused.',
  () => simulationEffectFacts([{ type: 'control', controlKind: 'stun' }], 'replaced by launch while Focused').facts
);

const devastatorTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and burn the target. If Focused remains active at the end of the full cast, emit the delayed Focused Devastation follow-up.',
  (balanceContext) =>
    simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.FOCUSED_DEVASTATION)!.effects,
      'additional follow-up while Focused'
    ).facts
);

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const engineerCoreTooltips = {
  skills: {
    // Describe the physical swap input, which first leaves an active kit.
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: skillTooltip(
      'Stow an active kit, or swap equipped weapon sets before combat begins.'
    ),
    ...Object.fromEntries(
      [ID.BOMB_KIT, ID.ELITE_MORTAR_KIT, ID.ELIXIR_GUN, ID.FLAMETHROWER, ID.GRENADE_KIT, ID.MED_KIT].map((id) => [
        id,
        kitEquipTooltip
      ])
    ),
    ...Object.fromEntries(
      [
        ID.STOW_BOMB_KIT,
        ID.STOW_ELITE_MORTAR_KIT,
        ID.STOW_ELIXIR_GUN,
        ID.STOW_FLAMETHROWER,
        ID.STOW_GRENADE_KIT,
        ID.STOW_MED_KIT
      ].map((id) => [id, kitStowTooltip])
    ),
    ...Object.fromEntries([ID.THROW_MINE, ID.MAGNETIC_SHIELD, ID.STATIC_SHIELD].map((id) => [id, armFlipTooltip])),
    ...Object.fromEntries([ID.THROW_SHIELD, ID.MAGNETIC_INVERSION].map((id) => [id, consumeFlipTooltip])),
    [ID.MINE_FIELD]: mineFieldTooltip,
    [ID.GLEAM_SABER_NON_HOLOSMITH]: gleamSaberTooltip,
    [SHARED_SKILL_IDS.DODGE]: dodgeTooltip,
    [ID.CONDUIT_SURGE]: conduitSurgeTooltip,
    [ID.LIGHTNING_ROD]: lightningRodTooltip,
    [ID.ELECTRIC_ARTILLERY]: electricArtilleryTooltip,
    [ID.ROILING_SKIES]: roilingSkiesTooltip,
    [ID.DEVASTATOR]: devastatorTooltip,
    [ID.AIR_BLAST]: (balanceContext, entity) => {
      const effects = balanceContext.catalog.skillsById.get(entity.id)!.effects!;
      const burning = effects.find((effect) => effect.type === 'custom')?.event;
      return {
        description: 'Knock back the target. Apply burning only if it is already burning when the blast arrives.',
        facts: [
          ...simulationEffectFacts(effects.filter((effect) => effect.type !== 'custom')).facts,
          ...simulationEffectFacts(
            burning
              ? [
                  {
                    type: 'condition',
                    condition: String(burning.condition),
                    stacks: tooltipNumber(burning, 'stacks'),
                    duration: tooltipNumber(burning, 'duration')
                  }
                ]
              : [],
            'requires burning at impact'
          ).facts
        ]
      };
    },
    [ID.HEALING_TURRET]: skillTooltip(
      "Place the turret and automatically trigger Cleansing Burst after placement. Detonate becomes available after a brief lockout; leaving it unused eventually replaces it with Cleansing Burst. The turret's recharge begins when detonated.",
      (balanceContext) =>
        simulationEffectFacts(
          balanceContext.catalog.skillsById
            .get(ID.CLEANSING_BURST)!
            .effects?.filter((effect) => effect.type === 'boon' || effect.type === 'buff'),
          'automatic Cleansing Burst'
        ).facts
    ),
    [ID.CLEANSING_BURST]: skillTooltip(
      "Trigger the turret's burst and water field, re-arm Detonate, and restart the window before another Cleansing Burst becomes available."
    ),
    [ID.DETONATE_HEALING_TURRET]: skillTooltip(
      "Detonate the turret, end its overcharge cycle, and start Healing Turret's recharge."
    ),
    [ID.DETONATE]: skillTooltip(
      'Detonate and consume the armed mine. Gadgeteer adds another copy of its strike, with a separate combo attempt.',
      (_c, selected) =>
        simulationEffectFacts(
          selected.effects?.filter((effect) => effect.type === 'strike'),
          'additional mine with Gadgeteer'
        ).facts
    )
  },
  traits: {
    ...engineerExplosivesTooltips,
    ...engineerToolsTooltips,
    ...engineerAlchemyTooltips,
    ...engineerFirearmsTooltips,
    ...engineerInventionsTooltips
  }
} satisfies ProfessionTooltips;
