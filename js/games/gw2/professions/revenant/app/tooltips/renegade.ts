import {
  fromProfile,
  outsideScopeTooltip,
  profileTooltip,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { RENEGADE_PROFILE_IDS as RENEGADE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { upkeepReleaseTooltip } from '#gw2/professions/revenant/app/tooltips/shared.js';

const bandTogetherTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const enhanced = balanceContext.catalog.skillsById.get(RENEGADE_ENHANCED_SKILL_BY_ID[Number(entity.id)])!;
  return {
    description:
      'Call a warband member. An ordinary cast primes Band Together; the next supported warband skill within its window consumes the enhancement and uses its enhanced package instead. Enhanced casts do not prime another enhancement.' +
      (selected.id === ID.RAZORCLAWS_RAGE
        ? ' Razorclaw grants finite bleeding charges to you and the assumed attacking allies.'
        : ''),
    facts: [
      ...(selected.id === ID.RAZORCLAWS_RAGE
        ? [
            ...simulationEffectFacts(
              balanceContext.catalog.skillsById.get(RENEGADE.razorclawsRageProc)!.effects,
              'per charge consumed'
            ).facts,
            {
              name: 'Bleed trigger cooldown',
              detail: tooltipSeconds(
                tooltipNumber(balanceContext.catalog.skillsById.get(RENEGADE.razorclawsRageProc), 'cooldown')
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
          ...simulationEffectFacts(tooltipProfile(balanceContext, RENEGADE.bandTogether).effects).facts
        ]
      },
      { label: 'Enhanced effects', facts: simulationEffectFacts(enhanced.effects).facts }
    ]
  };
};

const heroicCommandTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    "Refresh your active Kalla's Fervor stacks and grant might for each stack. Lasting Legacy replaces the base might amount. With no active Fervor, this grants no might.",
  facts: [
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById
        .get(entity.id)!
        .effects?.filter((effect) => effect.name !== 'lasting-legacy-might'),
      'per Fervor stack'
    ).facts,
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById
        .get(ID.HEROIC_COMMAND)!
        .effects?.filter((effect) => effect.name === 'lasting-legacy-might'),
      'per Fervor stack with Lasting Legacy instead'
    ).facts
  ]
});

const ordersFromAboveTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'Pulse alacrity. Righteous Rebel replaces the base pulse package; together with Bold Reversal it also adds protection.',
  facts: [
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById
        .get(entity.id)!
        .effects?.filter((effect) => effect.name !== 'righteous-rebel-alacrity'),
      'base pulses'
    ).facts,
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById
        .get(ID.ORDERS_FROM_ABOVE)!
        .effects?.filter((effect) => effect.name === 'righteous-rebel-alacrity'),
      'with Righteous Rebel instead'
    ).facts,
    ...simulationEffectFacts(
      tooltipProfile(balanceContext, RENEGADE.boldReversalRighteousRebel).effects,
      'additional pulses with both Righteous Rebel and Bold Reversal'
    ).facts
  ]
});

/** Describe renegade tooltips from the selected balance data. */
export const renegadeTooltips = {
  skills: {
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
          balanceContext.catalog.skillsById.get(RENEGADE.soulcleavesSummitProc)!.effects,
          'per eligible attack'
        ).facts,
        {
          name: 'Siphon trigger cooldown',
          detail: tooltipSeconds(
            tooltipNumber(balanceContext.catalog.skillsById.get(RENEGADE.soulcleavesSummitProc), 'cooldown')
          )
        }
      ]
    )
  },
  traits: {
    [TRAIT.AMBUSH_COMMANDER]: profileTooltip(
      RENEGADE.kallasFervor,
      "Qualifying critical or positional hits grant Kalla's Fervor. Defiant targets satisfy the simulator's positional condition.",
      [
        ['maximumStacks', 'Maximum stacks'],
        fromProfile(RENEGADE.kallasFervor, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
        fromProfile(
          RENEGADE.kallasFervor,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        ),
        ['lifeSiphonDamagePerStack', 'Life-siphon damage per stack', tooltipPercent]
      ]
    ),
    [TRAIT.ENDLESS_ENMITY]: profileTooltip(RENEGADE.endlessEnmity, 'Eligible critical hits grant fury to the party.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.BRUTAL_MOMENTUM]: profileTooltip(
      RENEGADE.brutalMomentum,
      'Gain critical-strike chance. Receiving fury grants vigor.',
      [
        ['criticalChance', 'Critical chance', tooltipPercent],
        ['fullEnduranceCriticalChance', 'Critical chance at full endurance', tooltipPercent],
        ['internalCooldown', 'Vigor cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.ASHEN_DEMEANOR]: profileTooltip(
      RENEGADE.ashenDemeanor,
      "Using a healing skill grants boons and Kalla's Fervor.",
      [
        ['cooldown', 'Internal cooldown', tooltipSeconds],
        ['fervorStacks', 'Fervor stacks gained']
      ]
    ),
    [TRAIT.BLOOD_FURY]: profileTooltip(
      RENEGADE.bloodFury,
      "Fury applications grant Kalla's Fervor. Bleeding lasts longer while you have fury.",
      [
        ['cooldown', 'Fervor cooldown', tooltipSeconds],
        ['conditionDurationBonus', 'Bleeding duration with fury', tooltipPercent]
      ]
    ),
    [TRAIT.WROUGHT_IRON_WILL]: outsideScopeTooltip,
    [TRAIT.BOLD_REVERSAL]: profileTooltip(
      RENEGADE.boldReversalRighteousRebel,
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
    [TRAIT.ALL_FOR_ONE]: profileTooltip(RENEGADE.allForOne, 'An empowered Band Together skill recharges faster.', [
      ['rechargeMultiplier', 'Empowered summon recharge duration', tooltipFactorChange]
    ]),
    [TRAIT.VINDICATION]: profileTooltip(
      RENEGADE.vindication,
      "Citadel Bombardment's first impact applies a daze control event."
    ),
    [TRAIT.LASTING_LEGACY]: profileTooltip(
      RENEGADE.kallasFervorLastingLegacy,
      "Kalla's Fervor lasts longer and grants stronger damage bonuses. Heroic Command grants additional might per Fervor stack.",
      [
        ['maximumStacks', 'Maximum stacks'],
        fromProfile(
          RENEGADE.kallasFervorLastingLegacy,
          'damageIncreasePerStack',
          'Strike damage per stack',
          tooltipPercent
        ),
        fromProfile(
          RENEGADE.kallasFervorLastingLegacy,
          'conditionDamageIncreasePerStack',
          'Condition damage per stack',
          tooltipPercent
        ),
        ['lifeSiphonDamagePerStack', 'Life-siphon damage per stack', tooltipPercent]
      ]
    ),
    [TRAIT.RIGHTEOUS_REBEL]: traitTooltip(
      'Orders from Above uses its extended alacrity pulse sequence.',
      (balanceContext) =>
        simulationEffectFacts(
          balanceContext.catalog.skillsById
            .get(ID.ORDERS_FROM_ABOVE)!
            .effects?.filter((effect) => effect.name === 'righteous-rebel-alacrity')
        ).facts
    )
  }
} satisfies ProfessionTooltips;
