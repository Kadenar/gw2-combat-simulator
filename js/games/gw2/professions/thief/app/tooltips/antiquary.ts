import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import {
  fromProfile,
  fromSkill,
  modifierFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Artifact windows supplement the native cast; charges apply to later attacks rather than adding immediate damage. */
const artifactTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const facts = [
    ...simulationEffectFacts(selected.effects?.filter((effect) => effect.packetLabel !== 'meticulous')).facts
  ];
  let description = 'Use and consume this held artifact. Artifact-use traits apply.';
  const window = (kryptis = false) =>
    facts.push(
      skillFact(balanceContext, entity.id, 'duration', 'Effect window', tooltipSeconds),
      profileFact(
        balanceContext,
        TRAIT.METICULOUS_CUSTODIAN,
        kryptis ? 'kryptisDuration' : 'duration',
        'Effect window with Meticulous Custodian',
        tooltipSeconds
      )
    );

  if (entity.id === ID.HOLO_DANCER_DECOY) {
    description +=
      ' Adds a timed charge that reduces the recharge of the next utility cast. Repeated grants queue and consume the oldest charge first.';
    window();
    facts.push(
      skillFact(
        balanceContext,
        entity.id,
        'rechargeMultiplier',
        'Next utility recharge multiplier',
        (value) => `${tooltipDecimal(value)}×`
      )
    );
  } else if (entity.id === ID.CHAK_SHIELD) {
    description +=
      ' Refunds initiative spent while its window lasts. Spending still advances initiative-spending traits. Meticulous Custodian also triggers an additional strike.';
    window();
    facts.push(
      ...simulationEffectFacts(
        tooltipProfile(balanceContext, TRAIT.METICULOUS_CUSTODIAN).effects,
        'additional strike with Meticulous Custodian'
      ).facts
    );
  } else if (entity.id === ID.SUMMON_KRYPTIS_TURRET) {
    description += ' Starts a temporary player strike-damage bonus.';
    window(true);
    facts.push(
      modifierFact(
        balanceContext,
        'thief.kryptis-turret-damage',
        'factor',
        'Player strike damage during window',
        tooltipFactorChange
      )
    );
  } else if (entity.id === ID.MISTBURN_MORTAR) {
    description +=
      ' Grants charges that add burning to later eligible player strikes. A new grant replaces remaining charges.';
    window();
    facts.push(
      skillFact(balanceContext, entity.id, 'maximumStacks', 'Charged strikes'),
      ...simulationEffectFacts(requireSkillAction(selected, 'charged').effects, 'per later charged strike').facts
    );
  } else if (entity.id === ID.ZEPHYRITE_SUN_CRYSTAL) {
    description += ' Meticulous Custodian adds burning to each eligible strike.';
    facts.push(
      ...simulationEffectFacts(
        selected.effects?.filter((effect) => effect.packetLabel === 'meticulous'),
        'additional burning per strike with Meticulous Custodian'
      ).facts
    );
  }

  return { description, facts };
};

/** Separate Guitar's attacks from its charge grants, keeping the final smash and charge cap distinct. */
const guitarTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id)!;
  const attacks = (skill.effects ?? []).flatMap((effect) =>
    simulationEffectFacts([{ ...effect, name: undefined }]).facts.map((fact) =>
      effect.type === 'strike' && effect.metadata?.packetKind === 'thief.metal-legion-guitar-final-smash'
        ? { ...fact, name: 'Final smash' }
        : fact
    )
  );
  return {
    description:
      'Consume this artifact to strike, inflict confusion, and stun. Grants charges for stealth attacks without entering stealth. Artifact-use traits apply.',
    facts: [],
    factSections: [
      { label: 'Base attacks', facts: attacks },
      {
        label: 'Stealth-attack charges',
        description: 'Newest charges are spent first. Reusing does not refresh older charges.',
        facts: [
          skillFact(balanceContext, entity.id, 'antiquaryStealthAttackCharges', 'Charges per use'),
          skillFact(balanceContext, entity.id, 'maximumStacks', 'Maximum charges'),
          {
            ...skillFact(balanceContext, entity.id, 'duration', 'Charge duration', tooltipSeconds),
            icon: MODIFIER_EFFECT_ICONS.Lifetime
          },
          {
            ...profileFact(
              balanceContext,
              TRAIT.METICULOUS_CUSTODIAN,
              'duration',
              'With Meticulous Custodian',
              tooltipSeconds
            ),
            icon: MODIFIER_EFFECT_ICONS.Lifetime
          }
        ]
      }
    ]
  };
};

const reshuffleTooltip: DescribeSimulationTooltip = skillTooltip(
  'Replace the available artifact choices. Retains the number of artifact uses remaining. Requires the Card Swap trait.'
);

const unstableSkrittBombTooltip: DescribeSimulationTooltip = skillTooltip(
  'Consume a held Skritt Scuffle artifact grant to explode the bomb, dealing strike damage and knocking enemies back. This backfire does not trigger regular artifact-use traits. Self-damage and incoming-damage penalties are outside simulation scope.'
);

const skrittSwipeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Trigger stealing traits and replace held artifacts with a new choice pool. Grants the base artifact use plus supported Skritt Swipe bonuses; resets the initiative-spending counter.',
  [
    fromProfile(TRAIT.TRINKET_COLLECTOR, 'maximumStacks', 'Base artifact uses'),
    fromProfile(TRAIT.PROLIFIC_PLUNDERER, 'resourceGain', 'Additional uses with Prolific Plunderer'),
    fromProfile(TRAIT.IMPROVISATION, 'resourceGain', 'Additional uses with Improvisation')
  ]
);

const skrittScuffleTooltip: DescribeSimulationTooltip = skillTooltip(
  'Summon an assistant that immediately pilfers artifacts and repeats while active. Each pilfer replaces artifact choices, including Unstable Skritt Bomb, and resets base uses. Multiple assistants run independently.',
  [
    fromSkill(ID.SKRITT_SCUFFLE, 'duration', 'Assistant duration', tooltipSeconds),
    fromSkill(ID.SKRITT_SCUFFLE, 'pulseInterval', 'Pilfer interval', tooltipSeconds)
  ]
);

const forgedSurferTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id)!;
  return {
    description:
      'Consume the artifact and schedule its dash followed by bombs while the buff lasts. Recasting restarts cadence and extends the remaining lifetime up to its cap. Each occurrence selects the current Meticulous Custodian alternative.',
    facts: [
      skillFact(balanceContext, entity.id, 'initialDelay', 'Dash delay', tooltipSeconds),
      skillFact(balanceContext, entity.id, 'pulseInterval', 'Bomb interval', tooltipSeconds),
      skillFact(balanceContext, entity.id, 'duration', 'Base buff duration', tooltipSeconds),
      skillFact(balanceContext, entity.id, 'enhancedDuration', 'Enhanced buff duration', tooltipSeconds),
      skillFact(balanceContext, entity.id, 'maximumDuration', 'Maximum remaining buff duration', tooltipSeconds),
      ...requireSkillAction(skill, 'surfer').effects.flatMap(
        (effect) => simulationEffectFacts([effect], effect.name).facts
      )
    ]
  };
};

const doubleEdgeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const description =
    "Succeeds when ready. Reusing during recharge takes the configured success or backfire outcome; Scoundrel's Luck guarantees a risky success and consumes its charge. Further risky uses remain available after a backfire.";

  if (entity.id === ID.STONE_SUMMIT_CANNON) {
    const skill = balanceContext.catalog.skillsById.get(entity.id)!;
    // Outcome headings replace internal packet names while preserving the selected balance values.
    const outcomeFacts = (outcome: 'success' | 'backfire') =>
      simulationEffectFacts(
        skill.effects
          ?.filter((effect) => effect.packetLabel === outcome)
          .map((effect) => ({ ...effect, name: undefined, packetLabel: undefined }))
      ).facts;
    return {
      description:
        "Always succeeds when ready. During recharge, uses the selected success or backfire outcome. Scoundrel's Luck consumes its charge to guarantee success during recharge. Can be reused after a backfire.",
      facts: [],
      factSections: [
        { label: 'Success', facts: outcomeFacts('success') },
        {
          label: 'Backfire',
          facts: [
            ...outcomeFacts('backfire'),
            skillFact(balanceContext, entity.id, 'backfireDelay', 'Backfire delay', tooltipSeconds)
          ]
        }
      ]
    };
  }

  // Show per-coin initiative payouts separately from the shared recharge and Luck rules.
  if (entity.id === ID.CANACH_COIN_TOSS)
    return {
      description:
        "Toss three coins to restore initiative. The simulator alternates heads and tails across uses, starting with heads. Always succeeds when ready. During recharge, uses the selected outcome unless Scoundrel's Luck consumes a charge to guarantee success. You can reuse it after a backfire.",
      facts: [],
      factSections: [
        {
          label: 'Success',
          facts: [{ name: 'Initiative restored', detail: '2 per head · 1 per tail' }]
        },
        {
          label: 'Backfire',
          facts: [{ name: 'Initiative restored', detail: '1 per head · 0 per tail' }]
        }
      ]
    };

  return {
    description: `${description} Antivenom's healing and self-damage do not vary player health in combat simulation.`,
    facts: simulationEffectFacts(balanceContext.catalog.skillsById.get(entity.id)!.effects, 'success only').facts
  };
};

/** Describe antiquary tooltips from the selected balance data. */
export const antiquaryTooltips = {
  skills: {
    ...Object.fromEntries(
      [
        ID.HOLO_DANCER_DECOY,
        ID.EXALTED_HAMMER,
        ID.CHAK_SHIELD,
        ID.ZEPHYRITE_SUN_CRYSTAL,
        ID.SUMMON_KRYPTIS_TURRET,
        ID.MISTBURN_MORTAR
      ].map((id) => [id, artifactTooltip])
    ),
    [ID.METAL_LEGION_GUITAR]: guitarTooltip,
    [ID.RESHUFFLE]: reshuffleTooltip,
    [ID.UNSTABLE_SKRITT_BOMB]: unstableSkrittBombTooltip,
    [ID.SKRITT_SWIPE]: skrittSwipeTooltip,
    [ID.SKRITT_SCUFFLE]: skrittScuffleTooltip,
    [ID.FORGED_SURFER_DASH]: forgedSurferTooltip,
    ...Object.fromEntries(
      [ID.STONE_SUMMIT_CANNON, ID.ANTIVENOM_DRAUGHT, ID.CANACH_COIN_TOSS].map((id) => [id, doubleEdgeTooltip])
    )
  },
  traits: {
    [TRAIT.TRINKET_COLLECTOR]: traitTooltip(
      'Unlock Antiquary, artifacts, Skritt Swipe, and double-edge skills. Pilfering replaces held artifacts; each artifact use consumes its selected slot.'
    ),
    [TRAIT.MAGPIES_DEFENSE]: outsideScopeTooltip,
    [TRAIT.ENTERPRISING_ARISTOCRAT]: traitTooltip('Using an artifact restores initiative.', [
      ['resourceGain', 'Initiative restored']
    ]),
    [TRAIT.CARD_SWAP]: traitTooltip(
      'Gain access to Reshuffle, which replaces the available artifact choices. Condition removal is not simulated.'
    ),
    [TRAIT.REPEAT_RANSACKER]: traitTooltip('Using an artifact reduces the active recharge of Skritt Swipe.', [
      ['rechargeReduction', 'Recharge removed', tooltipSeconds]
    ]),
    [TRAIT.PROLIFIC_PLUNDERER]: traitTooltip('Skritt Swipe grants an additional artifact use.', [
      ['resourceGain', 'Additional artifact uses']
    ]),
    [TRAIT.SCOUNDRELS_LUCK]: traitTooltip(
      "Skritt Swipe grants Scoundrel's Luck, making a risky double-edge cast succeed. New grants replace the charge instead of accumulating.",
      [
        ['maximumStacks', 'Charges'],
        ['internalCooldown', 'Grant cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.METICULOUS_CUSTODIAN]: traitTooltip(
      'Enhance artifacts: extend their special-effect windows, improve eligible strikes, burning and turret torment, and add a strike to Chak Shield.',
      [
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'guitarFactor', 'Guitar strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'guitarFinalFactor', 'Guitar final strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'mortarFactor', 'Mortar strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'holoFactor', 'Holo Dancer strike damage', tooltipFactorChange),
        fromProfile(TRAIT.METICULOUS_CUSTODIAN, 'kryptisFactor', 'Kryptis Turret strike damage', tooltipFactorChange),
        ['kryptisTormentDurationMultiplier', 'Kryptis Turret base torment duration', tooltipFactorChange],
        fromProfile(
          TRAIT.METICULOUS_CUSTODIAN,
          'mortarBurningDurationMultiplier',
          'Mortar burning duration',
          tooltipFactorChange
        ),
        fromProfile(
          TRAIT.METICULOUS_CUSTODIAN,
          'sunCrystalBurningDurationMultiplier',
          'Sun Crystal burning duration',
          tooltipFactorChange
        )
      ],
      'additional Chak Shield strike'
    ),
    [TRAIT.EXHILARATING_EPHEMERA]: traitTooltip(
      'Using an artifact extends a temporary strike-damage bonus, up to the maximum remaining duration.',
      [
        fromProfile(TRAIT.EXHILARATING_EPHEMERA, 'damageIncrease', 'Strike damage', tooltipPercent),
        ['durationExtension', 'Duration added', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining duration', tooltipSeconds]
      ]
    ),
    [TRAIT.PRODIGIOUS_PINCHER]: traitTooltip(
      'Spending enough initiative in combat pilfers a new set of artifacts and resets the spending counter.',
      [['threshold', 'Initiative spent to pilfer']]
    ),
    [TRAIT.POSSESSIVE_HOARDER]: (balanceContext, entity) => ({
      description:
        'Using an artifact grants alacrity to you and nearby allies, up to five targets. Offensive artifacts also grant might; defensive artifacts grant protection instead.',
      // Artifact categories follow the same named boons selected by combat.
      facts: [
        [BOON.MIGHT, 'offensive artifact'],
        [BOON.PROTECTION, 'defensive artifact'],
        [BOON.ALACRITY, 'any artifact']
      ].flatMap(([name, label]) => {
        const effect = requireEffect(tooltipProfile(balanceContext, entity.id), 'boon', name);
        return effect ? simulationEffectFacts([effect], label).facts : [];
      })
    }),
    // Separate per-stack bonuses from decay so the final expiry does not read as every stack's lifetime.
    [TRAIT.COMBAT_HIGH]: (balanceContext, entity) => ({
      description:
        'Skritt Swipe grants damage-bonus stacks that expire one at a time. Using it again replaces the remaining stacks and restarts their decay.',
      facts: [],
      factSections: [
        {
          label: 'Damage per stack',
          facts: [
            profileFact(balanceContext, entity.id, 'damageIncreasePerStack', 'Strike damage', tooltipPercent),
            profileFact(
              balanceContext,
              entity.id,
              'conditionDamageIncreasePerStack',
              'Condition damage',
              tooltipPercent
            )
          ]
        },
        {
          label: 'Stack decay',
          facts: [
            {
              ...profileFact(balanceContext, entity.id, 'maximumStacks', 'Stacks granted'),
              icon: MODIFIER_EFFECT_ICONS['Attribute increase']
            },
            {
              ...profileFact(balanceContext, entity.id, 'pulseInterval', 'Lose one stack every', tooltipSeconds),
              icon: MODIFIER_EFFECT_ICONS.Interval
            },
            {
              ...profileFact(balanceContext, entity.id, 'duration', 'Last stack expires after', tooltipSeconds),
              icon: MODIFIER_EFFECT_ICONS.Lifetime
            }
          ]
        }
      ]
    })
  }
} satisfies ProfessionTooltips;
