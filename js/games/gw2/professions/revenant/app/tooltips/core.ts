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
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { fieldValue } from '#gw2/platform/skills/field-specs.js';
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
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

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

// Use each spear attack's damage source as its row label and show the recharge reward once per cast.
function spearAttackTooltip(
  description: string,
  damageLabel = 'Strike damage'
): DescribeSimulationTooltip<RevenantSkill, RevenantSkill> {
  return (_context, skill) => {
    const effects = simulationEffectFacts(
      skill.effects?.map((effect) => (effect.type === 'strike' ? { ...effect, name: undefined } : effect))
    );
    const reduction = skill.rechargeReduction;
    return {
      ...effects,
      description,
      facts: [
        ...effects.facts.map((fact) => (fact.name === 'Strike damage' ? { ...fact, name: damageLabel } : fact)),
        ...(reduction ? [{ name: 'Abyssal Raze recharge', detail: `−${tooltipSeconds(reduction)}` }] : [])
      ]
    };
  };
}

// Label the impact and field separately while reading their damage from the selected patch.
const spiritcrushTooltip: DescribeSimulationTooltip = (context, entity) => {
  const effects = context.catalog.skillsById.get(entity.id)!.effects ?? [];
  const strikeLabels: Readonly<Record<string, string>> = {
    'Initial Damage': 'Initial strike',
    'Spiritcrush - Fire Field': 'Field pulses'
  };
  return {
    description: 'Create a pulsing fire field. The initial strike and each pulse inflict Burning and Slow.',
    facts: effects.flatMap((effect) => {
      const label = effect.type === 'strike' && effect.name && strikeLabels[effect.name];

      if (!label) return simulationEffectFacts([effect]).facts;

      return simulationEffectFacts([{ ...effect, name: undefined }]).facts.map((fact) => ({ ...fact, name: label }));
    })
  };
};

const abyssalRazeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const strike = selected.effects!.find((effect) => effect.type === 'strike')!;
  const cap = tooltipDecimal(tooltipNumber(selected, 'maximumStacks'));
  // A manual cast scales both effects. A full-stack swap keeps only the Torment bonus.
  return {
    description: `Strike and inflict Torment, then gain a stack of Crushing Abyss (maximum ${cap}).`,
    facts: simulationEffectFacts(
      selected
        .effects!.filter((effect) => !effect.metadata?.trigger)
        .map((effect) => (effect === strike ? { ...effect, name: undefined } : effect))
    ).facts.map((fact) => (fact.name === 'Crushing abyss' ? { ...fact, name: 'Crushing Abyss' } : fact)),
    factSections: [
      {
        label: 'Per Crushing Abyss stack at impact',
        facts: [
          { name: 'Strike damage', detail: tooltipPercent(tooltipNumber(strike, 'damageIncreasePerStack')) },
          ...simulationEffectFacts(selected.effects!.filter((effect) => effect.metadata?.trigger === 'crushing-abyss'))
            .facts
        ]
      },
      {
        label: `Weapon swap at ${cap} stacks`,
        description:
          'Swapping to different weapon types consumes all stacks and triggers another Raze with base strike damage and full bonus Torment.',
        facts: []
      }
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
    ...(entity.cost?.resource === 'endurance'
      ? [{ name: 'Endurance spent', detail: tooltipDecimal(entity.cost.amount) }]
      : []),
    ...[
      ['energyCost', 'Base energy cost'],
      ['upkeepCost', 'Energy upkeep per second']
    ].flatMap(([field, name]) =>
      fieldValue(entity, field) == null ? [] : [{ name, detail: tooltipDecimal(tooltipNumber(entity, field)) }]
    ),
    ...(entity.manualReleaseCooldown == null
      ? []
      : [{ name: 'Manual release cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'manualReleaseCooldown')) }]),
    ...(entity.starvationCooldown == null
      ? []
      : [{ name: 'Energy exhaustion cooldown', detail: tooltipSeconds(tooltipNumber(entity, 'starvationCooldown')) }])
  ],
  skills: {
    [ID.PHANTOMS_ONSLAUGHT_ID_62713]: skillTooltip(
      "Combat logs use this skill ID for the hit from Phantom's Onslaught."
    ),
    [ID.RITE_OF_THE_GREAT_DWARF]: skillTooltip('Reduce incoming damage for yourself and nearby allies.'),
    [ID.LEGENDARY_ASSASSIN_STANCE]: skillTooltip('Invoke Shiro to use the Legendary Assassin skills.'),
    [ID.LEGENDARY_CENTAUR_STANCE]: skillTooltip('Invoke Ventari to use the tablet and Legendary Centaur skills.'),
    [ID.CRYSTAL_HIBERNATION]: skillTooltip('Channel a protective shield to block attacks and heal nearby allies.'),
    [ID.LEGENDARY_DWARF_STANCE]: skillTooltip('Invoke Jalis to use the Legendary Dwarf skills.'),
    [ID.VENTARIS_WILL]: skillTooltip("Move Ventari's tablet to the chosen location."),
    [ID.LEGENDARY_DEMON_STANCE]: skillTooltip('Invoke Mallyx to use the Legendary Demon skills.'),
    [ID.RENEWING_WAVE]: skillTooltip('Heal nearby allies and cleanse their conditions.'),
    [ID.DEACTIVATE_OTHERWORLDLY_BOND]: skillTooltip('End your scepter tether and release its upkeep.'),
    [ID.SPIRITCRUSH]: spiritcrushTooltip,
    [ID.FRIGID_BLITZ]: skillTooltip('Teleport and strike, applying Chilled and Torment together.'),
    [ID.FORCED_ENGAGEMENT]: skillTooltip(
      'Strike and cripple one target. In game, targets beyond 600 range are pulled immediately; nearer targets are tethered for 5 seconds, revealed for 6 seconds, and pulled if they cross that threshold. The skill has 900 range and deals 200 bonus defiance damage to defiant foes. Target distance, tether movement, Revealed, and defiance-bar damage are not simulated.'
    ),
    [ID.PROJECT_TRANQUILITY]: skillTooltip(
      'Summon the tablet and gain Tranquil, empowering the next qualifying Centaur skill.'
    ),
    [ID.NATURAL_HARMONY]: skillTooltip(
      'Consume Tranquil when empowered; otherwise gain Tranquil after use. Healing is outside simulation scope. Empowered endurance is not yet modeled.'
    ),
    [ID.PURIFYING_ESSENCE]: skillTooltip(
      'Consume Tranquil when empowered; otherwise gain Tranquil after use. Healing and cleansing are outside simulation scope.'
    ),
    [ID.ENERGY_EXPULSION]: skillTooltip(
      'Knock down the target without destroying the tablet. Empowered casts grant Stability at cast commit and consume Tranquil; unempowered casts grant Tranquil.',
      (context) =>
        simulationEffectFacts(
          requireSkillAction(context.catalog.skillsById.get(ID.ENERGY_EXPULSION)!, 'empowered').effects,
          'when empowered'
        ).facts
    ),
    [SHARED_SKILL_IDS.SWAP_WEAPONS]: weaponSwapTooltip,
    [ID.SWAP_LEGENDS]: legendSwapTooltip,
    [SHARED_SKILL_IDS.DODGE]: dodgeTooltip,
    [ID.ANCIENT_ECHO]: ancientEchoTooltip,
    [ID.VENGEFUL_HAMMERS]: upkeepTooltip,
    [ID.PROTECTIVE_SOLACE]: skillTooltip(
      'Maintain the shield by spending Energy. Opening an empowered shield consumes Tranquil and grants Protection to nearby allies.',
      (context, skill) => [
        ...upkeepTooltip(context, skill).facts,
        ...simulationEffectFacts(
          requireSkillAction(context.catalog.skillsById.get(skill.id)!, 'empowered').effects,
          'on empowered opening'
        ).facts
      ]
    ),
    ...Object.fromEntries(
      [ID.RESIST_THE_DARKNESS, ID.RELEASE_HAMMERS, ID.DIMINISH_SOLACE, ID.RELINQUISH_POWER].map((id) => [
        id,
        upkeepReleaseTooltip
      ])
    ),
    [ID.ENCHANTED_DAGGERS]: enchantedDaggersTooltip,
    [ID.ABYSSAL_STRIKE]: spearAttackTooltip('Strike your target and inflict Torment and Vulnerability.'),
    [ID.ABYSSAL_FORCE]: spearAttackTooltip('Strike your target, burning and chilling it.'),
    [ID.ABYSSAL_BLITZ]: spearAttackTooltip(
      'Drop mines. Each explosion slows, chills, and weakens your target.',
      'Mine damage'
    ),
    [ID.BLITZ_MINES]: spearAttackTooltip('The mine explodes, slowing and weakening your target.', 'Mine damage'),
    [ID.ABYSSAL_BLOT]: spearAttackTooltip(
      'Pull and chill your target with the first pulse of a dark field. Each pulse inflicts Poison.',
      'Field damage'
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
      description: 'Strike repeatedly. Hit more times when the target uses the large hitbox setting.',
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
} satisfies ProfessionTooltips<RevenantSkill>;
