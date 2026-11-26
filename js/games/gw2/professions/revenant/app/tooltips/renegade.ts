import {
  fromProfile,
  maximumBonusFact,
  outsideScopeTooltip,
  profileCooldown,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipHasTrait,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { upkeepReleaseTooltip } from '#gw2/professions/revenant/app/tooltips/shared.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import {
  RAZORCLAW_PROC_ID,
  SOULCLEAVE_PROC_ID
} from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

const bandTogetherTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const enhanced = balanceContext.catalog.skillsById.get(RENEGADE_ENHANCED_SKILL_BY_ID[Number(entity.id)])!;
  return {
    description:
      'Call a warband member. A normal cast activates Band Together. Your next eligible warband skill before it expires consumes it and uses its enhanced effects. Enhanced casts do not activate Band Together again.' +
      (selected.id === ID.RAZORCLAWS_RAGE
        ? ' Razorclaw grants finite bleeding charges to you and the assumed attacking allies.'
        : ''),
    facts: [
      ...(selected.id === ID.RAZORCLAWS_RAGE
        ? [
            ...simulationEffectFacts(
              balanceContext.catalog.skillsById.get(RAZORCLAW_PROC_ID)!.effects,
              'per charge consumed'
            ).facts,
            {
              name: 'Bleed trigger cooldown',
              detail: tooltipSeconds(
                tooltipNumber(balanceContext.catalog.skillsById.get(RAZORCLAW_PROC_ID), 'cooldown')
              )
            }
          ]
        : [])
    ],
    // Enhanced casts replace the base payload; only ordinary casts prime another Band Together window.
    factTabs: [
      {
        label: 'Base effects',
        facts: [
          ...simulationEffectFacts(selected.effects).facts,
          ...simulationEffectFacts(
            requireSkillAction(balanceContext.catalog.skillsById.get(ID.LEGENDARY_RENEGADE_STANCE)!, 'band-together')
              .effects
          ).facts
        ]
      },
      { label: 'Enhanced effects', facts: simulationEffectFacts(enhanced.effects).facts }
    ]
  };
};

// Show the Might granted by one active Fervor stack using the build's selected trait.
const heroicCommandTooltip: DescribeSimulationTooltip = (context, entity, _spec, build) => {
  const effects = context.catalog.skillsById.get(entity.id)!.effects ?? [];
  const mightFacts = (legacy: boolean) =>
    simulationEffectFacts(
      effects
        .filter((effect) => effect.name === (legacy ? 'lasting-legacy-might' : BOON.MIGHT))
        .map((effect) => ({ ...effect, name: undefined }))
    ).facts.map((fact) => ({
      ...fact,
      name: 'Might per Fervor stack',
      detail: `${fact.stacks} ${fact.stacks === 1 ? 'stack' : 'stacks'} for ${fact.detail}`,
      stacks: undefined
    }));
  const description = "Refresh your active stacks of Kalla's Fervor. Each stack grants Might to your party.";

  if (!build)
    return {
      description,
      facts: [],
      factTabs: [
        { label: 'Base', facts: mightFacts(false) },
        { label: 'Lasting Legacy', facts: mightFacts(true) }
      ]
    };

  const legacy = selectedTraits(context.catalog, build.specializations).some(
    (trait) => trait.id === TRAIT.LASTING_LEGACY
  );
  return { description, facts: mightFacts(legacy) };
};

// Express each boon as a pulse count and duration, keeping the selected patch's recipient limit.
function orderPulseFacts(effects: readonly SkillEffect[]) {
  return simulationEffectFacts(effects.map((effect) => ({ ...effect, name: undefined }))).facts.map((fact) => ({
    ...fact,
    detail: `${fact.applications} ${fact.applications === 1 ? 'pulse' : 'pulses'} of ${fact.detail}`,
    applications: undefined
  }));
}

const ordersFromAboveTooltip: DescribeSimulationTooltip = (context, entity, _spec, build) => {
  const effects = context.catalog.skillsById.get(entity.id)!.effects ?? [];
  const alacrity = (rebel: boolean) =>
    orderPulseFacts(effects.filter((effect) => (effect.name === 'righteous-rebel-alacrity') === rebel));
  const protection = () => orderPulseFacts(tooltipProfile(context, TRAIT.BOLD_REVERSAL).effects ?? []);
  const description = 'Pulse Alacrity to your party.';

  if (!build)
    return {
      description,
      facts: [],
      factTabs: [
        { label: 'Base', facts: alacrity(false) },
        {
          label: 'Righteous Rebel',
          facts: [
            ...alacrity(true),
            ...protection().map((fact) => ({ ...fact, name: `${fact.name} with Bold Reversal` }))
          ]
        }
      ]
    };

  const traits = new Set(selectedTraits(context.catalog, build.specializations).map((trait) => trait.id));
  const rebel = traits.has(TRAIT.RIGHTEOUS_REBEL);
  const withProtection = rebel && traits.has(TRAIT.BOLD_REVERSAL);
  return {
    description: withProtection ? 'Pulse Alacrity and Protection to your party.' : description,
    facts: [...alacrity(rebel), ...(withProtection ? protection() : [])]
  };
};

/** Describe renegade tooltips from the selected balance data. */
export const renegadeTooltips = {
  skills: {
    [ID.LEGENDARY_RENEGADE_STANCE]: skillTooltip('Invoke Kalla to call members of her warband.'),
    [ID.CITADEL_BOMBARDMENT]: skillTooltip(
      'Bombard the target with burning artillery strikes.',
      (context, _skill, build) =>
        tooltipHasTrait(context, build, TRAIT.VINDICATION)
          ? simulationEffectFacts(tooltipProfile(context, TRAIT.VINDICATION).effects, 'first impact').facts
          : []
    ),
    [ID.DISMISS_LIEUTENANT_SOULCLEAVE]: upkeepReleaseTooltip,
    ...Object.fromEntries(
      [ID.ICERAZORS_IRE, ID.DARKRAZORS_DARING, ID.RAZORCLAWS_RAGE, ID.BREAKRAZORS_BASTION].map((id) => [
        id,
        bandTogetherTooltip
      ])
    ),
    [ID.HEROIC_COMMAND]: heroicCommandTooltip,
    [ID.ORDERS_FROM_ABOVE]: ordersFromAboveTooltip,
    [ID.SOULCLEAVES_SUMMIT]: skillTooltip(
      "Maintain Soulcleave's upkeep. Eligible attacks trigger additional life-siphon damage with an internal cooldown. The simulation also includes the configured allied attackers; Kalla's Fervor increases the siphon damage.",
      (balanceContext) => [
        ...simulationEffectFacts(
          balanceContext.catalog.skillsById.get(SOULCLEAVE_PROC_ID)!.effects,
          'per eligible attack'
        ).facts,
        {
          name: 'Siphon trigger cooldown',
          detail: tooltipSeconds(tooltipNumber(balanceContext.catalog.skillsById.get(SOULCLEAVE_PROC_ID), 'cooldown'))
        }
      ]
    )
  },
  traits: {
    [TRAIT.AMBUSH_COMMANDER]: traitTooltip(
      "Qualifying critical or positional hits grant Kalla's Fervor. Defiant targets satisfy the simulator's positional condition.",
      [
        maximumBonusFact('damageIncreasePerStack', 'maximumStacks', 'Maximum strike damage bonus'),
        maximumBonusFact('conditionDamageIncreasePerStack', 'maximumStacks', 'Maximum condition damage bonus'),
        maximumBonusFact('lifeSiphonDamagePerStack', 'maximumStacks', 'Maximum life-siphon damage bonus'),
        fromProfile(TRAIT.AMBUSH_COMMANDER, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(
          TRAIT.AMBUSH_COMMANDER,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        ),
        ['lifeSiphonDamagePerStack', 'Life-siphon damage per stack', tooltipPercent]
      ]
    ),
    [TRAIT.ENDLESS_ENMITY]: traitTooltip('Eligible critical hits grant fury to the party.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.BRUTAL_MOMENTUM]: traitTooltip('Gain critical-strike chance. Receiving fury grants vigor.', [
      ['criticalChance', 'Critical chance', tooltipPercent],
      ['fullEnduranceCriticalChance', 'Critical chance at full endurance', tooltipPercent],
      ['internalCooldown', 'Vigor cooldown', tooltipSeconds]
    ]),
    [TRAIT.ASHEN_DEMEANOR]: traitTooltip("Using a healing skill grants boons and Kalla's Fervor.", [
      profileCooldown('Internal cooldown'),
      ['fervorStacks', 'Fervor stacks gained']
    ]),
    [TRAIT.BLOOD_FURY]: traitTooltip(
      "Fury applications grant Kalla's Fervor. Bleeding lasts longer while you have fury.",
      [profileCooldown('Fervor cooldown'), ['conditionDurationBonus', 'Bleeding duration with fury', tooltipPercent]]
    ),
    [TRAIT.WROUGHT_IRON_WILL]: outsideScopeTooltip,
    [TRAIT.BOLD_REVERSAL]: traitTooltip(
      'Orders from Above also grants protection when Righteous Rebel is selected.',
      undefined,
      'with Righteous Rebel'
    ),
    [TRAIT.HEARTPIERCER]: traitTooltip(
      'Player-owned strikes deal increased damage to bleeding targets. Bleeding also deals increased damage.',
      [
        fromProfile(
          TRAIT.HEARTPIERCER,
          'damageMultiplier',
          'Strike damage against bleeding targets',
          tooltipFactorChange
        ),
        fromProfile(TRAIT.HEARTPIERCER, 'conditionDamageMultiplier', 'Bleeding damage', tooltipFactorChange)
      ]
    ),
    [TRAIT.ALL_FOR_ONE]: traitTooltip('An empowered Band Together skill recharges faster.', [
      ['rechargeMultiplier', 'Empowered summon recharge duration', tooltipFactorChange]
    ]),
    [TRAIT.VINDICATION]: traitTooltip("Citadel Bombardment's first impact dazes the target."),
    [TRAIT.LASTING_LEGACY]: traitTooltip(
      "Kalla's Fervor lasts longer and grants stronger damage bonuses. Heroic Command grants additional might per Fervor stack.",
      [
        maximumBonusFact('damageIncreasePerStack', 'maximumStacks', 'Maximum strike damage bonus'),
        maximumBonusFact('conditionDamageIncreasePerStack', 'maximumStacks', 'Maximum condition damage bonus'),
        maximumBonusFact('lifeSiphonDamagePerStack', 'maximumStacks', 'Maximum life-siphon damage bonus'),
        fromProfile(TRAIT.LASTING_LEGACY, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(
          TRAIT.LASTING_LEGACY,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        ),
        ['lifeSiphonDamagePerStack', 'Life-siphon damage per stack', tooltipPercent]
      ]
    ),
    [TRAIT.RIGHTEOUS_REBEL]: traitTooltip(
      'Orders from Above pulses Alacrity more times. With Bold Reversal, it also pulses Protection.',
      (context) =>
        orderPulseFacts(
          context.catalog.skillsById
            .get(ID.ORDERS_FROM_ABOVE)!
            .effects?.filter((effect) => effect.name === 'righteous-rebel-alacrity') ?? []
        )
    )
  }
} satisfies ProfessionTooltips;
