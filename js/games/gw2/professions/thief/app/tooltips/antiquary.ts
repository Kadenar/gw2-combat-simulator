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
  tooltipFactorChange,
  tooltipPercent,
  tooltipPercentValue,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Artifact windows supplement the native cast; charges apply to later attacks rather than adding immediate damage. */
const artifactTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const facts = [
    ...simulationEffectFacts(selected.effects?.filter((effect) => effect.packetLabel !== 'meticulous')).facts
  ];
  const description = 'Use and consume this held artifact. Artifact-use traits apply.';
  // Section headings identify the source; attack rows need only their payload and recipient information.
  const attacks = () =>
    simulationEffectFacts(selected.effects?.map((effect) => ({ ...effect, name: undefined }))).facts;
  const window = (label: string, kryptis = false) => [
    {
      ...skillFact(balanceContext, entity.id, 'duration', label, tooltipSeconds),
      icon: MODIFIER_EFFECT_ICONS.Lifetime
    },
    {
      ...profileFact(
        balanceContext,
        TRAIT.METICULOUS_CUSTODIAN,
        kryptis ? 'kryptisDuration' : 'duration',
        'With Meticulous Custodian',
        tooltipSeconds
      ),
      icon: MODIFIER_EFFECT_ICONS.Lifetime
    }
  ];
  const charges = (field: string, label: string) => ({
    ...skillFact(balanceContext, entity.id, field, label),
    icon: MODIFIER_EFFECT_ICONS['Maximum stacks']
  });

  if (entity.id === ID.CHAK_SHIELD) {
    return {
      description:
        'Consume this artifact to strike foes and grant initiative-refund charges. Artifact-use traits apply.',
      facts: [],
      factSections: [
        { label: 'Base attacks', facts: attacks() },
        {
          label: 'Initiative refunds',
          description:
            'Each paid weapon skill consumes a charge and refunds its full initiative cost. Reusing adds charges without refreshing older ones. Spending still counts toward initiative-spending traits.',
          facts: [
            charges('refundCharges', 'Charges per use'),
            charges('maximumStacks', 'Maximum charges'),
            ...window('Charge duration')
          ]
        },
        {
          label: 'With Meticulous Custodian',
          description: 'Adds a strike when you use this artifact.',
          facts: simulationEffectFacts(
            tooltipProfile(balanceContext, TRAIT.METICULOUS_CUSTODIAN).effects?.map((effect) => ({
              ...effect,
              name: undefined
            }))
          ).facts
        }
      ]
    };
  } else if (entity.id === ID.SUMMON_KRYPTIS_TURRET) {
    return {
      description:
        'Consume this artifact to summon a turret that strikes and inflicts torment. Gain a temporary bonus to your strike damage. Artifact-use traits apply.',
      facts: [],
      factSections: [
        { label: 'Base turret attacks', facts: attacks() },
        {
          label: 'Player damage bonus',
          facts: [
            modifierFact(balanceContext, 'thief.kryptis-turret-damage', 'factor', 'Strike damage', tooltipFactorChange),
            ...window('Bonus duration', true)
          ]
        }
      ]
    };
  } else if (entity.id === ID.MISTBURN_MORTAR) {
    return {
      description:
        'Consume this artifact to bombard foes with strikes and burning. Grants charges that add burning to later attacks. Artifact-use traits apply.',
      facts: [],
      factSections: [
        { label: 'Base mortar attacks', facts: attacks() },
        {
          label: 'Charged strikes',
          description:
            'Player strikes and new damaging condition applications consume charges, sharing a cooldown. Reusing adds charges with separate expiries.',
          facts: [
            charges('maximumStacks', 'Charges per use'),
            ...simulationEffectFacts(requireSkillAction(selected, 'charged').effects).facts.map((fact) => ({
              ...fact,
              name: `${fact.name} per charged strike`
            })),
            ...window('Charge duration')
          ]
        }
      ]
    };
  } else if (entity.id === ID.ZEPHYRITE_SUN_CRYSTAL) {
    // Distinguish the base attack from the extra burning triggered by Meticulous Custodian.
    const crystalEffects = (enhanced: boolean) =>
      simulationEffectFacts(
        selected.effects
          ?.filter((effect) => (effect.packetLabel === 'meticulous') === enhanced)
          .map((effect) => ({ ...effect, name: undefined, packetLabel: undefined }))
      ).facts;
    return {
      description: 'Consume this artifact to dash, strike foes, and inflict burning and blindness.',
      facts: [],
      factSections: [
        { label: 'Base attack', facts: crystalEffects(false) },
        {
          label: 'With Meticulous Custodian',
          description: 'Adds a second burning stack when the strike hits.',
          facts: crystalEffects(true).map((fact) => ({ ...fact, name: `Additional ${fact.name.toLowerCase()}` }))
        }
      ]
    };
  }

  return { description, facts };
};

/** Keep initial boons separate from the delayed explosion and the charge spent by a later utility cast. */
const holoDancerTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id)!;
  const effects = (skill.effects ?? []).map((effect) => ({ ...effect, name: undefined }));
  const explosion = effects.filter((effect) => (effect.atMs ?? 0) > 0);
  return {
    description:
      'Consume this artifact to taunt foes and grant might. The decoy later explodes, dealing damage and granting might and fury. Artifact-use traits apply.',
    facts: [],
    factSections: [
      {
        label: 'On use',
        facts: simulationEffectFacts(effects.filter((effect) => (effect.atMs ?? 0) === 0)).facts
      },
      ...(explosion.length
        ? [
            {
              label: 'Explosion',
              facts: [
                {
                  name: 'Delay after use',
                  detail: tooltipSeconds(explosion[0].atMs! / 1000),
                  icon: MODIFIER_EFFECT_ICONS.Interval
                },
                ...simulationEffectFacts(explosion).facts
              ]
            }
          ]
        : []),
      {
        label: 'Utility recharge',
        description: 'Grants a charge for your next utility skill. Oldest charges are spent first.',
        facts: [
          skillFact(balanceContext, entity.id, 'rechargeMultiplier', 'Recharge reduction', (value) =>
            tooltipPercentValue(1 - value)
          ),
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
        description:
          'Starting a stealth attack spends the newest charge, even while stealthed. Older grants keep their original expiry.',
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

/** Trait bonuses add to the base artifact uses; they are not alternative totals. */
const skrittSwipeTooltip: DescribeSimulationTooltip = (balanceContext) => ({
  description:
    "Steal artifacts and replace your current choices. Triggers stealing traits and resets Prodigious Pincher's initiative-spending progress.",
  facts: [],
  factSections: [
    {
      label: 'Artifact uses',
      description: 'Selected trait bonuses add to the base amount.',
      facts: [
        profileFact(balanceContext, TRAIT.TRINKET_COLLECTOR, 'maximumStacks', 'Base uses'),
        profileFact(
          balanceContext,
          TRAIT.PROLIFIC_PLUNDERER,
          'resourceGain',
          'Prolific Plunderer bonus',
          (value) => `+${value}`
        ),
        profileFact(balanceContext, TRAIT.IMPROVISATION, 'resourceGain', 'Improvisation bonus', (value) => `+${value}`)
      ].map((fact) => ({ ...fact, icon: MODIFIER_EFFECT_ICONS['Artifact uses'] }))
    }
  ]
});

const skrittScuffleTooltip: DescribeSimulationTooltip = skillTooltip(
  'Summon an assistant that immediately pilfers artifacts and repeats while active. Each pilfer replaces artifact choices, including Unstable Skritt Bomb, and resets base uses. Multiple assistants run independently.',
  [
    fromSkill(ID.SKRITT_SCUFFLE, 'duration', 'Assistant duration', tooltipSeconds),
    fromSkill(ID.SKRITT_SCUFFLE, 'pulseInterval', 'Pilfer interval', tooltipSeconds)
  ]
);

/** Keep base and enhanced payloads in separate tabs, with each dash and bomb labeled only once. */
const forgedSurferTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const skill = balanceContext.catalog.skillsById.get(entity.id)!;
  const effects = requireSkillAction(skill, 'surfer').effects;
  const attackFacts = (packet: string, suffix: string) =>
    simulationEffectFacts(
      effects.filter((effect) => effect.name === packet).map((effect) => ({ ...effect, name: undefined }))
    ).facts.map((fact) => ({ ...fact, name: `${fact.name} ${suffix}` }));
  return {
    description:
      'Consume this artifact to dash, then drop bombs at regular intervals. The dash and bombs deal strike damage and inflict burning. Using it again refreshes the duration and restarts the attacks.',
    facts: [
      {
        ...skillFact(balanceContext, entity.id, 'initialDelay', 'Delay before dash', tooltipSeconds),
        icon: MODIFIER_EFFECT_ICONS.Interval
      },
      {
        ...skillFact(balanceContext, entity.id, 'pulseInterval', 'Time between bombs', tooltipSeconds),
        icon: MODIFIER_EFFECT_ICONS.Interval
      }
    ],
    factTabs: [false, true].map((enhanced) => ({
      label: enhanced ? 'Meticulous Custodian' : 'Base',
      facts: [
        {
          name: 'Duration',
          detail: tooltipSeconds(
            Math.min(
              skillNumber(skill, enhanced ? 'enhancedDuration' : 'duration'),
              skillNumber(skill, 'maximumDuration')
            )
          ),
          icon: MODIFIER_EFFECT_ICONS.Lifetime
        },
        ...attackFacts(enhanced ? 'Meticulous Dash' : 'Dash', 'on dash'),
        ...attackFacts(enhanced ? 'Meticulous Bomb' : 'Bomb', 'per bomb')
      ]
    }))
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
      [ID.EXALTED_HAMMER, ID.CHAK_SHIELD, ID.ZEPHYRITE_SUN_CRYSTAL, ID.SUMMON_KRYPTIS_TURRET, ID.MISTBURN_MORTAR].map(
        (id) => [id, artifactTooltip]
      )
    ),
    [ID.HOLO_DANCER_DECOY]: holoDancerTooltip,
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
          'Mortar base burning duration',
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
