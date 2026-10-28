import {
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipPercent,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { revenantCorruptionTooltips } from '#gw2/professions/revenant/app/tooltips/corruption.js';
import { revenantDevastationTooltips } from '#gw2/professions/revenant/app/tooltips/devastation.js';
import { revenantInvocationTooltips } from '#gw2/professions/revenant/app/tooltips/invocation.js';
import { revenantRetributionTooltips } from '#gw2/professions/revenant/app/tooltips/retribution.js';
import { revenantSalvationTooltips } from '#gw2/professions/revenant/app/tooltips/salvation.js';
import {
  upkeepReleaseTooltip,
  upkeepTooltip,
  variantEffects,
  vindicatorDodgeTooltip
} from '#gw2/professions/revenant/app/tooltips/shared.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

const weaponSwapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Switch weapon sets. At maximum Crushing Abyss, swapping to a different weapon loadout consumes the stacks and triggers Abyssal Raze. The triggered strike uses its base coefficient and retains the stack-scaled torment.'
);

const legendSwapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Invoke your other equipped legend and reset energy. Ordinary upkeep skills stop; Facet of Nature can continue across legends. Combat invocation traits and swap sigils apply.',
  (balanceContext, entity) => [
    { name: 'Energy after invoking', detail: tooltipDecimal(tooltipNumber(entity, 'resourceGain')) },
    profileFact(balanceContext, TRAIT.CHARGED_MISTS, 'resourceGain', 'Energy with Charged Mists'),
    profileFact(
      balanceContext,
      TRAIT.CHARGED_MISTS,
      'threshold',
      'Charged Mists threshold: previous energy rounded down'
    )
  ]
);

const dodgeTooltip: DescribeSimulationTooltip = (context, entity, specialization, build) =>
  build?.specializations.some((selection) => selection.name === 'Vindicator')
    ? vindicatorDodgeTooltip(context, entity, specialization, build)
    : {
        description:
          'Spend endurance to dodge and apply supported dodge-related traits. Incoming damage is outside simulation scope.',
        facts: []
      };

const ancientEchoTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const effects = variantEffects(balanceContext.catalog.skillsById.get(entity.id)!.effects);
  return {
    ...effects,
    description: 'Restore energy and apply only the package matching your active core legend.',
    facts: [
      ...effects.facts,
      {
        name: 'Energy restored',
        detail: tooltipDecimal(tooltipNumber(balanceContext.catalog.skillsById.get(entity.id), 'resourceGain'))
      }
    ]
  };
};

const enchantedDaggersTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'Prepare a finite set of enchanted daggers. Qualifying player strikes consume one ready, unexpired charge for additional life-siphon damage. Siphons cannot critically strike.',
  facts: (balanceContext.catalog.skillsById.get(entity.id)!.effects || []).flatMap(
    (effect) =>
      simulationEffectFacts(
        [{ ...effect, ...(effect.type === 'strike' ? { canCrit: false } : {}) }],
        effect.type === 'strike' ? 'per consumed charge' : ''
      ).facts
  )
});

const spearRechargeTooltip: DescribeSimulationTooltip = skillTooltip(
  "Attack and reduce Abyssal Raze's ammunition recharge when this skill's first damage packet lands.",
  (_c, entity) => [
    { name: 'Abyssal Raze recharge reduction', detail: tooltipSeconds(tooltipNumber(entity, 'rechargeReduction')) }
  ]
);

const abyssalRazeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const strike = selected.effects!.find((effect) => effect.type === 'strike')!;
  return {
    description:
      'Strike and inflict torment, increasing damage and adding torment for each Crushing Abyss stack already active at impact. Then gain a stack if below the cap. At the cap, swapping to a different weapon loadout consumes the stacks for an additional Raze with base strike damage.',
    facts: [
      ...simulationEffectFacts(
        selected.effects!.filter((effect) => !effect.metadata?.trigger),
        'base cast'
      ).facts,
      ...simulationEffectFacts(
        selected.effects!.filter((effect) => effect.metadata?.trigger === 'crushing-abyss'),
        'additional torment per Crushing Abyss stack'
      ).facts,
      {
        name: 'Strike damage per Crushing Abyss stack',
        detail: tooltipPercent(tooltipNumber(strike, 'damageIncreasePerStack'))
      },
      { name: 'Maximum Crushing Abyss stacks', detail: tooltipDecimal(tooltipNumber(selected, 'maximumStacks')) }
    ]
  };
};

const blossomingAuraTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const final = selected.effects!.find((effect) => effect.type === 'strike' && effect.name === 'Final Damage')!;
  return {
    description:
      "Attach an aura that pulses damage, then detonates and weakens the target. Detonating early cancels remaining pulses. The final strike grows with elapsed pulse intervals, up to the engine's detonation cap.",
    facts: [
      ...simulationEffectFacts(selected.effects, 'complete aura; final strike shown before growth').facts,
      { name: 'Aura duration', detail: tooltipSeconds(tooltipNumber(selected, 'duration')) },
      { name: 'Pulse interval', detail: tooltipSeconds(tooltipNumber(selected, 'pulseInterval')) },
      {
        name: 'Final damage increase per elapsed interval',
        detail: tooltipPercent(tooltipNumber(final, 'damageIncreasePerStack'))
      }
    ]
  };
};

const detonateBlossomingAuraTooltip: DescribeSimulationTooltip = skillTooltip(
  'Detonate your active Blossoming Aura immediately. Its final damage scales with elapsed pulse intervals, applies weakness, and cancels remaining pulses.',
  (balanceContext) =>
    simulationEffectFacts(
      balanceContext.catalog.skillsById
        .get(ID.BLOSSOMING_AURA)!
        .effects?.filter((effect) => effect.name !== 'Pulsing Damage'),
      'base detonation before elapsed-interval scaling'
    ).facts
);

/** Compose core skills and trait-line tooltips from the selected balance data. */
export const revenantCoreTooltips = {
  skillFacts: (_c, entity) => [
    // Fixed dodge costs come from the action declaration rather than patchable fields.
    ...(entity.cost?.resource === 'endurance' && entity.cost.amount != null
      ? [{ name: 'Endurance spent', detail: tooltipDecimal(entity.cost.amount) }]
      : []),
    ...[
      ['energyCost', 'Base energy cost'],
      ['upkeepCost', 'Energy upkeep per second']
    ].flatMap(([field, name]) =>
      entity[field] == null ? [] : [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
    ),
    ...(entity.manualReleaseCooldown == null
      ? []
      : [{ name: 'Manual release cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'manualReleaseCooldown')) }]),
    ...(entity.starvationCooldown == null
      ? []
      : [{ name: 'Energy exhaustion cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'starvationCooldown')) }])
  ],
  skills: {
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: weaponSwapTooltip,
    [ID.SWAP_LEGENDS]: legendSwapTooltip,
    [SHARED_SKILL_IDS.DODGE]: dodgeTooltip,
    [ID.ANCIENT_ECHO]: ancientEchoTooltip,
    ...Object.fromEntries([ID.VENGEFUL_HAMMERS, ID.PROTECTIVE_SOLACE].map((id) => [id, upkeepTooltip])),
    ...Object.fromEntries(
      [ID.RESIST_THE_DARKNESS, ID.RELEASE_HAMMERS, ID.DIMINISH_SOLACE, ID.RELINQUISH_POWER].map((id) => [
        id,
        upkeepReleaseTooltip
      ])
    ),
    [ID.ENCHANTED_DAGGERS]: enchantedDaggersTooltip,
    ...Object.fromEntries(
      [ID.ABYSSAL_BLITZ, ID.ABYSSAL_BLOT, ID.ABYSSAL_FORCE, ID.ABYSSAL_STRIKE].map((id) => [id, spearRechargeTooltip])
    ),
    [ID.ABYSSAL_RAZE]: abyssalRazeTooltip,
    [ID.BLOSSOMING_AURA]: blossomingAuraTooltip,
    [ID.DETONATE_BLOSSOMING_AURA]: detonateBlossomingAuraTooltip,
    [ID.EMBRACE_THE_DARKNESS]: (balanceContext, entity) => ({
      description:
        'Maintain a damaging aura that drains energy and pulses torment. Completing a skill that costs energy, including this activation, empowers the next torment pulse. Normal and empowered torment are alternatives; pulses do not empower themselves.',
      facts: [
        ...(balanceContext.catalog.skillsById.get(entity.id)!.effects || []).flatMap(
          (effect) =>
            simulationEffectFacts(
              [effect],
              effect.metadata?.trigger ? 'empowered pulse instead of normal torment' : 'normal pulse'
            ).facts
        ),
        {
          name: 'Pulse interval',
          detail: tooltipSeconds(tooltipNumber(balanceContext.catalog.skillsById.get(entity.id), 'pulseInterval'))
        }
      ]
    }),
    [ID.IMPOSSIBLE_ODDS]: skillTooltip(
      'Maintain upkeep to trigger an additional strike after eligible player-owned hits, subject to its trigger cooldown. These follow-ups cannot trigger themselves.',
      (_c, entity) => [
        { name: 'Trigger cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'triggerIntervalMs') / 1000) }
      ]
    ),
    [ID.DROP_THE_HAMMER]: skillTooltip(
      'Drop a hammer that strikes and controls your target. Its damage impact resets Coalescence of Ruin.'
    ),
    [ID.CALL_TO_ANGUISH]: skillTooltip(
      'Leap to your target and apply the listed effects. Completing this action unlocks Unyielding Impact until the follow-up is used or legend state clears it.'
    ),
    [ID.UNYIELDING_IMPACT]: skillTooltip(
      'Use the follow-up unlocked by Call to Anguish, then consume its availability.'
    ),
    [ID.IMPERIAL_GUARD]: skillTooltip(
      'Enter the blocking animation and unlock True Strike. Its follow-up window remains briefly after the channel ends. The simulation does not require an incoming attack to unlock True Strike.'
    ),
    [ID.TRUE_STRIKE]: skillTooltip(
      'Strike using the follow-up unlocked by Imperial Guard, then consume the follow-up window.'
    ),
    [ID.OTHERWORLDLY_BOND]: skillTooltip(
      'Apply the supported bond effects and open the temporary scepter follow-up window.'
    ),
    [ID.ETERNITYS_REQUIEM]: (balanceContext, entity) => ({
      description: 'Strike repeatedly. Additional packets hit only a target configured with a large hitbox.',
      // The separately gated strike owns the large-target component in both the tooltip and simulation.
      facts: (balanceContext.catalog.skillsById.get(entity.id)!.effects || []).flatMap((effect) =>
        effect.type === 'strike'
          ? simulationEffectFacts(
              [effect],
              effect.when ? 'additional hits on a large target' : 'hits on either target size'
            ).facts
          : simulationEffectFacts([effect]).facts
      )
    })
  },
  traits: {
    ...revenantInvocationTooltips,
    ...revenantRetributionTooltips,
    ...revenantSalvationTooltips,
    ...revenantCorruptionTooltips,
    ...revenantDevastationTooltips
  }
} satisfies ProfessionTooltips;
