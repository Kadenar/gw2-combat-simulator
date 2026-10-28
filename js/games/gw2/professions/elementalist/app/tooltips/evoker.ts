import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  elementalProcessionEffects,
  IGNITE_TIERS,
  igniteTierEffect,
  projectIgniteEffects
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import { familiarBlessingEffects } from '#gw2/professions/elementalist/specializations/evoker/traits/familiar-blessing.js';

/** Describe evoker tooltips from the selected balance data. */
export const evokerTooltips = {
  skills: {
    ...Object.fromEntries(
      [...FAMILIAR_ELEMENTS].map(([id]) => [
        id,
        skillTooltip(
          BASIC_FAMILIARS.has(id)
            ? 'Release the matching familiar, spend the full charge bar, and add an empowered stack. Reaching the stack threshold unlocks empowered familiars. Using this basic familiar too soon after its empowered version cancels the remaining empowered effects.'
            : 'Release the empowered familiar and spend your empowered stacks. Its effects and eligible familiar traits apply while its sequence runs.',
          [
            fromProfile(
              TRAIT.EVOCATION,
              BASIC_FAMILIARS.has(id) ? 'maximumStacks' : 'minimumStacks',
              BASIC_FAMILIARS.has(id) ? 'Familiar charges required' : 'Empowered stacks required'
            )
          ]
        )
      ])
    ),
    [ID.REJUVENATE]: skillTooltip('Refill the familiar charge bar. Healing is outside combat simulation scope.', [
      fromProfile(TRAIT.EVOCATION, 'maximumStacks', 'Base charges after use')
    ]),
    [ID.FOXS_FURY]: (balanceContext, entity) => {
      const skill = requireSkillFromContext(balanceContext, entity.id);
      // Present tiers as alternatives, without duplicating them as unconditional ordinary effects.
      return {
        description:
          'Grant party might and Fury, with additional might while attuned to Fire. Strike and burn using the tier selected by your might at cast start. Altruistic Aspect can add its meditation boon.',
        facts: [
          skillFact(balanceContext, ID.FOXS_FURY, 'mightTierThreshold', 'Might stacks per additional tier'),
          ...simulationEffectFacts(skill.effects, 'mutually exclusive might tiers').facts,
          ...simulationEffectFacts(
            requireSkillAction(skill, 'boons').effects.map((effect) => ({
              ...effect,
              audience: { recipients: RECIPIENT.PARTY }
            })),
            'Fire Bonus is additional only in Fire'
          ).facts
        ]
      };
    },
    [ID.HARES_AGILITY]: skillTooltip(
      'Gain Electric Enchantment charges that add strikes to familiar attacks. Trigger Altruistic Aspect when selected.',
      // The buff's stack count and duration describe the same charge batch granted in combat.
      (_balanceContext, skill) =>
        simulationEffectFacts(requireSkillAction(skill, 'electric-enchantment').effects, 'Electric Enchantment charges')
          .facts
    ),
    [ID.TOADS_FORTITUDE]: skillTooltip(
      "Apply the meditation's effects. While attuned to Earth, additionally grant party resistance. Trigger Altruistic Aspect when selected.",
      // Runtime and tooltip share the selected Earth-gated action, including explicit payload removal.
      (_balanceContext, skill) =>
        simulationEffectFacts(requireSkillAction(skill, 'earth-resistance').effects, 'only in Earth').facts
    ),
    [ID.ELEMENTAL_PROCESSION]: skillTooltip(
      'Release the direct effects of all four empowered familiars as independent sequences. Trigger Altruistic Aspect when selected.',
      (balanceContext) =>
        elementalProcessionEffects(balanceContext.catalog.skillsById).flatMap(
          ({ familiar, effects }) => simulationEffectFacts(effects, familiar.name).facts
        )
    ),
    [ID.IGNITE]: (balanceContext, entity) => {
      const familiar = balanceContext.catalog.skillsById.get(entity.id);

      if (!familiar) throw new Error(`Missing familiar tooltip skill: ${entity.id}`);

      // Each alternative projects the surviving native packets, exactly as an accepted consecutive-use tier does.
      const tiers = IGNITE_TIERS.map((label, tier) => ({
        label,
        model: simulationEffectFacts(
          projectIgniteEffects(familiar.effects ?? [], igniteTierEffect(balanceContext, tier))
        )
      }));
      return {
        description:
          "Spend the full familiar charge bar and add an empowered stack. Ignite's Burning duration advances through consecutive-use tiers and resets after inactivity. The last tier repeats until reset. Each listed duration replaces the native Burning duration.",
        facts: [
          skillFact(balanceContext, ID.IGNITE, 'tierResetDuration', 'Inactivity before tier reset', tooltipSeconds),
          profileFact(balanceContext, TRAIT.EVOCATION, 'maximumStacks', 'Familiar charges required')
        ],
        factTabs: tiers.map(({ label, model }) => ({ label, facts: model.facts })),
        incomplete: tiers.some(({ model }) => model.incomplete)
      };
    },
    [ID.CALCIFY]: skillTooltip(
      'While the Earth familiar is selected, disabling an enemy grants Protection to yourself. The active familiar blast can trigger this passive.',
      (balanceContext, skill) => [
        ...simulationEffectFacts(requireSkillAction(skill, 'protection').effects, 'on disabling an enemy').facts,
        skillFact(balanceContext, ID.CALCIFY, 'internalCooldown', 'Protection interval', tooltipSeconds)
      ]
    ),
    [ID.ZAP]: skillTooltip(
      'Spend the full familiar charge bar, add an empowered stack, and strike with your familiar. Gain the Zap buff for eligible follow-up effects.',
      (_balanceContext, skill) => simulationEffectFacts(requireSkillAction(skill, 'zap-window').effects).facts
    ),
    [ID.LIGHTNING_BLITZ]: skillTooltip(
      'Spend your empowered familiar stacks and release the attack sequence. Gain an Electric Enchantment charge for additional familiar strikes.',
      (_balanceContext, skill) =>
        simulationEffectFacts(requireSkillAction(skill, 'electric-enchantment').effects, 'Electric Enchantment charges')
          .facts
    )
  },
  traits: {
    [TRAIT.EVOCATION]: traitTooltip(
      'Unlock Evoker, familiars, meditations, and familiar charges. Choose a familiar element; with Fire selected, burning applications grant might.',
      [
        // Entry traits share Evocation's cooldown policy, separate from fire-familiar might.
        [
          'internalCooldown',
          "Attunement-entry trait cooldown (Sunspot, Pyromancer's Puissance, Earthen Blast, Rock Solid)",
          tooltipSeconds
        ],
        fromProfile(TRAIT.EVOCATION, 'pulseInterval', 'Fire-familiar might cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.ENHANCED_POTENCY]: traitTooltip(
      'With Air selected, fury grants ferocity and additional critical chance. With Fire selected, might grants additional condition damage.',
      [
        ['attributeBonuses.ferocity', 'Air ferocity with fury'],
        ['criticalChance', 'Air additional critical chance with fury', tooltipPercent],
        ['attributePerStack', 'Fire condition damage per might']
      ]
    ),
    [TRAIT.FAMILIARS_PROWESS]: traitTooltip(
      'Completing a familiar skill starts or extends a damage-bonus window. Air selection increases strike damage; Fire selection increases condition damage.',
      [
        ['damageIncrease', 'Air strike damage', tooltipPercent],
        ['conditionDamageIncrease', 'Fire condition damage', tooltipPercent],
        ['baseDuration', 'Initial duration', tooltipSeconds],
        ['durationPerTier', 'Duration added while active', tooltipSeconds],
        ['maximumStacks', 'Maximum remaining duration', tooltipSeconds]
      ]
    ),
    [TRAIT.FIERY_MIGHT]: traitTooltip('Deal increased strike damage against burning targets.', [
      fromProfile(TRAIT.FIERY_MIGHT, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.ALTRUISTIC_ASPECT]: traitTooltip('Completing an eligible meditation grants its corresponding boon.'),
    [TRAIT.SPIRITS_SUCCOR]: outsideScopeTooltip,
    [TRAIT.FAMILIARS_FOCUS]: traitTooltip(
      "Improve Familiar's Prowess, using the stronger bonus for the selected element.",
      [
        ['damageIncrease', 'Air strike damage', tooltipPercent],
        ['conditionDamageIncrease', 'Fire condition damage', tooltipPercent]
      ]
    ),
    [TRAIT.FAMILIARS_BLESSING]: (balanceContext) => ({
      description:
        'Completing a Fire or Air familiar grants quickness. Water or Earth familiars grant alacrity instead.',
      facts: familiarBlessingEffects(balanceContext).flatMap(
        ({ elements, effect }) => simulationEffectFacts([effect], `${elements.join(' / ')} familiar`).facts
      )
    }),
    [TRAIT.ELEMENTAL_DYNAMO]: traitTooltip('Entering your selected familiar element grants familiar charges.', [
      ['resourceGain', 'Charges gained']
    ]),
    [TRAIT.GALVANIC_ENCHANTMENT]: traitTooltip(
      'Completing a familiar grants Electric Enchantment charges. Your next qualifying player strikes consume charges to trigger an additional strike and burning.',
      [
        ['playerStacks', 'Charges granted'],
        ['duration', 'Charge duration', tooltipSeconds]
      ],
      'per charge consumed'
    ),
    [TRAIT.ELEMENTAL_BALANCE]: traitTooltip(
      'Entering your selected familiar element enough times opens a brief window. The next non-autoattack weapon skill in that window has reduced recharge.',
      [
        ['threshold', 'Entries required'],
        ['duration', 'Skill-use window', tooltipSeconds],
        ['rechargeMultiplier', 'Next eligible skill recharge', tooltipFactorChange]
      ]
    ),
    [TRAIT.SPECIALIZED_ELEMENTS]: traitTooltip(
      'Lock attunement to the selected familiar element and generate more charges from matching eligible weapon skills. Familiar casts reduce active weapon cooldowns; empowered familiars also trigger elemental entry traits.',
      [
        ['maximumStacks', 'Maximum familiar charges'],
        ['playerStacks', 'Charges per matching weapon skill'],
        fromProfile(
          TRAIT.SPECIALIZED_ELEMENTS,
          'rechargeMultiplier',
          'Base weapon recharge removed by basic familiar',
          (value) => tooltipPercent(1 - value)
        ),
        fromProfile(
          TRAIT.SPECIALIZED_ELEMENTS,
          'empoweredRechargeMultiplier',
          'Base weapon recharge removed by empowered familiar',
          (value) => tooltipPercent(1 - value)
        )
      ]
    )
  }
} satisfies ProfessionTooltips;
