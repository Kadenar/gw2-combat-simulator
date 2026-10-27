import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext, skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { resolveAshes, type ResolvedAshes } from '#gw2/professions/guardian/specializations/firebrand/ashes-tuning.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import {
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  tooltipSeconds,
  tooltipPercent,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';
import { virtueBoons } from '#gw2/professions/guardian/app/tooltips/shared.js';
import { FIREBRAND_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/guardian/specializations/firebrand/ids.js';

/** Resolved Ashes payloads reuse the shared effect formatter so Burning rows match the grant rows' icons and stacks. */
function ashesBurningFacts(burning: ResolvedAshes['burning'], qualifier: string) {
  return simulationEffectFacts(
    [
      {
        type: 'condition',
        name: CONDITION.BURNING,
        condition: CONDITION.BURNING,
        stacks: burning.stacks,
        duration: burning.baseDurationSeconds
      }
    ],
    qualifier
  ).facts;
}

const stowTomeTooltip: DescribeSimulationTooltip = skillTooltip(
  'Close the active tome and restore your weapon skills. This ends the current consecutive-page sequence for Swift Scholar.'
);

const tomePageTooltip: DescribeSimulationTooltip = skillTooltip(
  'Use a page from the matching open tome and apply these effects. Pages are shared across tomes and regenerate after spending begins. Applicable tome traits can add boons or refund pages; the tome stays open until stowed.'
);

/** Describe firebrand tooltips from the selected balance data. */
export const firebrandTooltips = {
  skillFacts: (_c, entity) =>
    // Only tome pages spend this resource; other canonical costs have their own facts.
    entity.resourceCost == null || !entity.tome
      ? []
      : [{ name: 'Tome pages spent', detail: tooltipDecimal(tooltipNumber(entity, 'resourceCost')) }],
  skills: {
    [ID.STOW_TOME]: stowTomeTooltip,
    ...Object.fromEntries(
      [
        ID.AZURE_SUN,
        ID.DARING_CHALLENGE,
        ID.DESERT_BLOOM,
        ID.ETERNAL_OASIS,
        ID.HEATED_REBUKE,
        ID.IGNITING_BURST,
        ID.RADIANT_RECOVERY,
        ID.SCORCHED_AFTERMATH,
        ID.SEARING_SPELL,
        ID.SHINING_RIVER,
        ID.STALWART_STAND,
        ID.UNBROKEN_LINES,
        ID.UNFLINCHING_CHARGE,
        ID.VALIANT_BULWARK
      ].map((id) => [id, tomePageTooltip])
    ),
    ...Object.fromEntries(
      [ID.TOME_OF_JUSTICE, ID.TOME_OF_RESOLVE, ID.TOME_OF_COURAGE].map((id) => [
        id,
        skillTooltip(
          'Open this tome and replace your weapon bar with its pages. Opening a ready tome starts passive dormancy and grants Swift Scholar quickness. Reopening a dormant tome preserves that timer. Switching tomes resets the consecutive-page refund sequence.',
          (balanceContext) => [
            {
              name: 'Base passive dormancy',
              detail: tooltipSeconds(skillNumberFromContext(balanceContext, id, 'dormantCooldown'))
            },
            profileFact(balanceContext, TRAIT.PURITY_OF_WORD, 'maximumStacks', 'Base shared page capacity'),
            profileFact(
              balanceContext,
              TRAIT.PURITY_OF_WORD,
              'pulseInterval',
              'Base page regeneration interval',
              tooltipSeconds
            ),
            ...simulationEffectFacts(
              tooltipProfile(balanceContext, TRAIT.SWIFT_SCHOLAR).effects,
              'when the passive was ready'
            ).facts
          ]
        )
      ])
    ),
    // This distinct recorded variant has no tome-opening action or simulated payload.
    [ID.TOME_OF_COURAGE_ID_42371]: skillTooltip(
      'This Tome of Courage variant has no simulated effects. It does not open a tome, start passive dormancy, or grant Swift Scholar quickness.'
    ),
    ...Object.fromEntries(
      MANTRAS.flatMap((mantra) => [
        [
          mantra.rootId,
          skillTooltip(
            'Prepare this mantra and unlock its charged uses. Equipped mantras begin the simulation prepared and rearm automatically after a full recharge.'
          )
        ],
        [
          mantra.normalId,
          skillTooltip(
            'Spend a prepared mantra charge and apply these effects. The last remaining charge uses the separate final-charge skill.'
          )
        ],
        [
          mantra.finalId,
          skillTooltip(
            'Spend the final mantra charge and apply these effects. The mantra becomes unavailable until its full recharge finishes, then automatically prepares again.'
          )
        ]
      ])
    ),
    [ID.ASHES_OF_THE_JUST]: (context, _entity, _specialization, build) => {
      // Resolve saved trait positions against the displayed patch; absent build context is explicitly baseline.
      const ashes = resolveAshes({
        catalog: context.catalog,
        traits: new Set(build ? selectedTraits(context.catalog, build.specializations).map((trait) => trait.id) : [])
      });
      const grant = simulationEffectFacts(
        requireSkillAction(requireSkillFromContext(context, ID.ASHES_OF_THE_JUST), 'grant').effects.map((effect) => ({
          ...effect,
          audience: { recipients: RECIPIENT.PARTY }
        })),
        'on cast'
      ).facts;
      const perCharge = ashes
        ? [
            ...ashesBurningFacts(ashes.burning, build ? 'per charge' : 'baseline per charge · no build selected'),
            { name: 'Minimum trigger interval', detail: tooltipSeconds(ashes.triggerIntervalSeconds) }
          ]
        : [];
      const adjustment =
        ashes?.overrideTraitId !== undefined
          ? [
              {
                name: 'Selected adjustment',
                detail: `${tooltipProfile(context, ashes.overrideTraitId).name} — provisional`
              },
              ...ashesBurningFacts(ashes.baseline, 'baseline per charge')
            ]
          : [];
      return {
        description:
          "Grant Ashes of the Just and might to your party. Each recipient's qualifying strikes spend one charge to burn the target. Burning values are base values before duration bonuses.",
        facts: [...grant, ...perCharge, ...adjustment]
      };
    }
  },
  traits: {
    [TRAIT.PURITY_OF_WORD]: traitTooltip('Unlock tomes and their shared page resource.'),
    [TRAIT.SWIFT_SCHOLAR]: traitTooltip(
      'Opening a tome with a ready passive grants quickness. Consecutive page skills in the same tome refund a page.',
      [
        ['minimumStacks', 'Consecutive page skills required'],
        ['resourceGain', 'Pages refunded']
      ]
    ),
    [TRAIT.IMBUED_HASTE]: traitTooltip('Quickness grants condition damage, healing power, and vitality.', [
      ['attributeBonus', 'Each attribute with quickness', tooltipDecimal]
    ]),
    [TRAIT.UNRELENTING_CRITICISM]: traitTooltip('Player axe strikes inflict bleeding.'),
    [TRAIT.LIBERATORS_VOW]: traitTooltip('Using a healing skill grants quickness to the party.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.ARCHIVIST_OF_WHISPERS]: traitTooltip('Increase the shared tome-page capacity.', [
      ['maximumStacks', 'Maximum pages']
    ]),
    [TRAIT.WEIGHTY_TERMS]: traitTooltip("Using a mantra's final charge grants pages and inflicts slow.", [
      ['resourceGain', 'Pages gained']
    ]),
    [TRAIT.STALWART_SPEED]: traitTooltip('Applying aegis or stability grants quickness to the party.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.LEGENDARY_LORE]: virtueBoons('Using a tome page grants a boon according to the active tome.'),
    [TRAIT.STOIC_DEMEANOR]: traitTooltip('Control, immobilize, or slow applications grant resistance and might.'),
    [TRAIT.QUICKFIRE]: traitTooltip(
      'Applying quickness grants an Ashes of the Just charge to a recipient. Justice retains its passive while dormant.',
      [['internalCooldown', 'Charge-grant cooldown', tooltipSeconds]]
    ),
    [TRAIT.LOREMASTER]: traitTooltip('Tome pages regenerate faster.', [
      ['pulseInterval', 'Page regeneration interval', tooltipSeconds]
    ])
  }
} satisfies ProfessionTooltips;

/** Provisional facts always read selected values, so editing an assumption cannot leave stale tooltip numbers. */
export const firebrandReworkTooltips = {
  traits: {
    [TRAIT.PURITY_OF_WORD]: traitTooltip('Unlock tomes and their shared page resource.', (context) => [
      profileFact(context, TRAIT.PURITY_OF_WORD, 'maximumStacks', 'Shared page capacity'),
      profileFact(context, TRAIT.PURITY_OF_WORD, 'pulseInterval', 'Page regeneration interval', tooltipSeconds)
    ]),
    [TRAIT.IMBUED_HASTE]: traitTooltip(
      'Provisional: assume Quickness still enables increased outgoing condition damage. The percentage is speculative. Healing and incoming damage are outside simulation scope.',
      [['conditionDamageIncrease', 'Provisional condition damage', tooltipPercent]]
    ),
    [TRAIT.UNRELENTING_CRITICISM]: traitTooltip(
      'Increase bleeding damage and duration. Both bonuses are provisional.',
      [
        ['conditionDamageIncrease', 'Provisional bleeding damage', tooltipPercent],
        ['conditionDurationBonus', 'Provisional bleeding duration', tooltipPercent]
      ]
    ),
    [REWORK.REVELATION]: traitTooltip('Final mantra charges grant pages.', [['resourceGain', 'Pages gained']]),
    [REWORK.BASTION]: traitTooltip(
      'Protection has increased effectiveness on you. Incoming damage is outside simulation scope.'
    ),
    [REWORK.FERVID_CONVICTION]: traitTooltip(
      'Swift Scholar page refunds grant Ashes to nearby allies. Provisional: includes self; charge count, lifetime, recipient limit and internal cooldown are assumptions.',
      [
        ['maximumTargets', 'Provisional maximum recipients'],
        ['internalCooldown', 'Provisional internal cooldown', tooltipSeconds]
      ],
      'provisional grant per Swift Scholar refund'
    ),
    [TRAIT.STALWART_SPEED]: traitTooltip(
      'Swift Scholar page refunds grant party Quickness. Duration, recipient limit and internal cooldown are provisional.',
      [['internalCooldown', 'Provisional internal cooldown', tooltipSeconds]],
      'provisional grant per Swift Scholar refund'
    ),
    [TRAIT.STOIC_DEMEANOR]: traitTooltip(
      'Retain Courage passive while dormant. Disabling or immobilizing enemies reduces Unbroken Lines recharge. Recharge reduction and internal cooldown are provisional.',
      [
        ['rechargeReduction', 'Provisional recharge reduction', tooltipSeconds],
        ['internalCooldown', 'Provisional internal cooldown', tooltipSeconds]
      ]
    ),
    [REWORK.RIGHTEOUS_FLAMES]: traitTooltip(
      'When selected, retain Justice passive while dormant and replace Ashes Burning per charge with these values. Base duration and stacks are provisional; the final improvement is unknown.',
      [],
      'provisional per Ashes charge, before duration bonuses'
    ),
    [REWORK.DELIVERANCE]: traitTooltip(
      'Retain Resolve passive while dormant. Passive healing is outside simulation scope.'
    )
  }
} satisfies ProfessionTooltips;
