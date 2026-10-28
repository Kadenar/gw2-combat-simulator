import {
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipNumber,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { engineerAlchemyTooltips } from '#gw2/professions/engineer/app/tooltips/alchemy.js';
import { engineerExplosivesTooltips } from '#gw2/professions/engineer/app/tooltips/explosives.js';
import { engineerFirearmsTooltips } from '#gw2/professions/engineer/app/tooltips/firearms.js';
import { engineerInventionsTooltips } from '#gw2/professions/engineer/app/tooltips/inventions.js';
import { armFlipTooltip, gleamSaberTooltip } from '#gw2/professions/engineer/app/tooltips/shared.js';
import { engineerToolsTooltips } from '#gw2/professions/engineer/app/tooltips/tools.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

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
    { name: 'Endurance cost', detail: String(ENDURANCE.dodgeCost) },
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById.get(ID.VENT_EXHAUST)?.effects,
      'requires Thermal Release Valve and active Photon Forge'
    ).facts
  ]
);

// Focused templates are selected at impact, so presentation lists both branches explicitly.
const conduitSurgeTooltip: DescribeSimulationTooltip = (context) => ({
  description:
    'Strike and burn the target, establishing Focused for subsequent spear attacks. Refreshing Focused preserves a longer existing window.',
  facts: [
    ...simulationEffectFacts(requireSkillAction(requireSkillFromContext(context, ID.CONDUIT_SURGE), 'payload').effects)
      .facts,
    skillFact(context, ID.CONDUIT_SURGE, 'duration', 'Focused duration', tooltipSeconds)
  ]
});
const lightningRodTooltip: DescribeSimulationTooltip = (context) => ({
  description:
    'Start a repeating strike sequence that builds charges and later unlocks Electric Artillery. Each pulse checks whether the target is Focused. Recasting replaces the sequence and clears previous charges.',
  facts: [false, true].flatMap(
    (focused) =>
      simulationEffectFacts(
        requireSkillAction(requireSkillFromContext(context, ID.LIGHTNING_ROD), 'payload').effects.filter(
          (effect) => effect.name?.startsWith('Focused ') === focused
        ),
        focused ? 'per pulse while Focused' : 'per pulse without Focused'
      ).facts
  )
});
const electricArtilleryTooltip: DescribeSimulationTooltip = (context) => ({
  description:
    "Release the projectile and consume Lightning Rod's unexpired charges and follow-up. Charges are snapshotted on release; Focused is checked at impact. Charges extend burning and determine vulnerability stacks. Vulnerability duration is fixed.",
  facts: [false, true].flatMap((focused) => {
    const qualifier = focused ? 'while Focused' : 'without Focused';
    return [
      ...requireSkillAction(requireSkillFromContext(context, ID.ELECTRIC_ARTILLERY), 'payload')
        .effects.filter((effect) => effect.name?.startsWith('Focused ') === focused)
        .flatMap(
          (effect) =>
            simulationEffectFacts(
              [effect],
              qualifier +
                (effect.type === 'condition' && effect.condition === CONDITION.VULNERABILITY
                  ? ' · per complete charge group'
                  : effect.type === 'condition' && effect.condition === CONDITION.BURNING
                    ? ' · base duration before charges'
                    : '')
            ).facts
        ),
      skillFact(context, ID.ELECTRIC_ARTILLERY, 'maximumStacks', 'Maximum charges counted ' + qualifier),
      skillFact(
        context,
        ID.ELECTRIC_ARTILLERY,
        focused ? 'focusedChargesPerVulnerability' : 'chargesPerVulnerability',
        'Charges per vulnerability group ' + qualifier
      ),
      skillFact(
        context,
        ID.ELECTRIC_ARTILLERY,
        focused ? 'focusedBurningDurationPerCharge' : 'burningDurationPerCharge',
        'Burning duration added per charge ' + qualifier,
        tooltipSeconds
      )
    ];
  })
});

const roilingSkiesTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and cripple the target. Also stun it, or launch it instead while Focused.',
  () =>
    simulationEffectFacts([{ type: 'control', controlKind: CONTROL.STUN }], 'replaced by launch while Focused').facts
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
