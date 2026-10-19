import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import {
  elementalProcessionEffects,
  IGNITE_TIERS,
  igniteTierEffect,
  projectIgniteEffects
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import { familiarBlessingEffects } from '#gw2/professions/elementalist/specializations/evoker/traits/familiar-blessing.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as EVOKER } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';

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
              EVOKER.resources,
              BASIC_FAMILIARS.has(id) ? 'maximumStacks' : 'minimumStacks',
              BASIC_FAMILIARS.has(id) ? 'Familiar charges required' : 'Empowered stacks required'
            )
          ]
        )
      ])
    ),
    [ID.REJUVENATE]: skillTooltip('Refill the familiar charge bar. Healing is outside combat simulation scope.', [
      fromProfile(EVOKER.resources, 'maximumStacks', 'Base charges after use')
    ]),
    [ID.FOXS_FURY]: skillTooltip(
      'Grant party might and Fury, with additional might while attuned to Fire. Also strike and burn your target using the tier selected by your might at cast start. Altruistic Aspect can add its meditation boon.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.foxsFury, 'threshold', 'Might stacks per additional tier'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.foxsFury).effects?.filter((effect) => effect.name?.startsWith('Tier ')),
          'mutually exclusive might tiers'
        ).facts,
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.foxsFury)
            .effects?.filter((effect) => effect.name?.startsWith('Fox'))
            .map((effect) => ({ ...effect, audience: { recipients: RECIPIENT.PARTY } })),
          'Fire Bonus is additional only in Fire'
        ).facts
      ]
    ),
    [ID.HARES_AGILITY]: skillTooltip(
      'Gain Electric Enchantment charges that add strikes to familiar attacks. Trigger Altruistic Aspect when selected.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.haresAgility, 'playerStacks', 'Electric Enchantment charges'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.haresAgility).effects?.filter(
            (effect) => effect.name === 'Hare Enchantment'
          )
        ).facts
      ]
    ),
    [ID.TOADS_FORTITUDE]: skillTooltip(
      "Apply the meditation's effects. While attuned to Earth, additionally gain resistance. Trigger Altruistic Aspect when selected.",
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.toadsFortitude).effects?.filter(
            (effect) => effect.name === 'Toad Resistance'
          ),
          'only in Earth'
        ).facts
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
          profileFact(balanceContext, EVOKER.ignite, 'threshold', 'Inactivity before tier reset', tooltipSeconds),
          profileFact(balanceContext, EVOKER.resources, 'maximumStacks', 'Familiar charges required')
        ],
        factTabs: tiers.map(({ label, model }) => ({ label, facts: model.facts })),
        incomplete: tiers.some(({ model }) => model.incomplete)
      };
    },
    [ID.CALCIFY]: skillTooltip(
      'While the Earth familiar is selected, disabling an enemy grants Protection to yourself. The active familiar blast can trigger this passive.',
      (balanceContext) => [
        ...simulationEffectFacts(tooltipProfile(balanceContext, EVOKER.calcify).effects, 'on disabling an enemy').facts,
        profileFact(balanceContext, EVOKER.calcify, 'internalCooldown', 'Protection interval', tooltipSeconds)
      ]
    ),
    [ID.ZAP]: skillTooltip(
      'Spend the full familiar charge bar, add an empowered stack, and strike with your familiar. Gain the Zap buff for eligible follow-up effects.',
      (balanceContext) =>
        simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.zap).effects?.filter((effect) => effect.name === 'Zap Window')
        ).facts
    ),
    [ID.LIGHTNING_BLITZ]: skillTooltip(
      'Spend your empowered familiar stacks and release the attack sequence. Gain an Electric Enchantment charge for additional familiar strikes.',
      (balanceContext) => [
        profileFact(balanceContext, EVOKER.lightningBlitz, 'resourceGain', 'Electric Enchantment charges'),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, EVOKER.lightningBlitz).effects?.filter(
            (effect) => effect.name === 'Lightning Blitz Enchantment'
          )
        ).facts
      ]
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
        fromProfile(EVOKER.ignite, 'pulseInterval', 'Fire-familiar might cooldown', tooltipSeconds)
      ]
    ),
    [TRAIT.ENHANCED_POTENCY]: traitTooltip(
      'With Air selected, fury grants ferocity and additional critical chance. With Fire selected, might grants additional condition damage.',
      [
        ['attributeBonus', 'Air ferocity with fury'],
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
