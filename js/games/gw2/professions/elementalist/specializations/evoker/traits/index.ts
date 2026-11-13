// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { BoonId } from '#gw2/platform/constants.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumber,
  balanceProfileNumber,
  ownerAttributeBonusNumber,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { type ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import type {
  ElementalistEntryTransition,
  ElementalistTransitionDelivery
} from '#gw2/professions/elementalist/core/mechanics/attunement-transition.js';
import {
  elementalistAnnouncement,
  elementalistEventSkill
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalistMightStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { reenterEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  evokerCastCompleted,
  evokerCastSettled,
  evokerEntryObserved,
  evokerEventAccepted,
  evokerInitialized,
  familiarSettled,
  type EvokerEvent
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import {
  commitRechargeDuration,
  specializedElementsAvailability
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import { familiarBlessingName } from '#gw2/professions/elementalist/specializations/evoker/traits/familiar-blessing.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

const boon = (name: string, boonName: BoonId, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

/** Owns Evocation tuning at its existing execution boundaries. */
const evocation = defineTrait({
  id: TRAIT.EVOCATION,
  balance: {
    // Evocation unlocks both charge pools, weapon gains, and the shared attunement lockout.
    maximumStacks: 6,
    minimumStacks: 3,
    playerStacks: 2,
    allyStacks: 1,
    recharge: 1.5,
    internalCooldown: 5,
    // Fire-familiar Might has its own interval, separate from the entry cooldown.
    pulseInterval: 1,
    effects: [boon('Fire Familiar', BOON.MIGHT, 1, 6)]
  },
  triggers: [
    onTriggerPoint(evokerEventAccepted, {
      requiresSelection: false,
      run: (runtime: ElementalistRuntime, { event }: EvokerEvent) => applyEvocationBurning(runtime, event)
    })
  ]
});

/** Owns Elemental Balance tuning at its existing execution boundaries. */
const elementalBalance = defineTrait({
  id: TRAIT.ELEMENTAL_BALANCE,
  balance: {
    threshold: 2,
    duration: 5,
    rechargeMultiplier: 0.34
  },
  triggers: [
    onTriggerPoint(evokerEntryObserved, {
      run: (runtime: ElementalistRuntime, input: ElementalistTransitionDelivery<ElementalistEntryTransition>) =>
        applyElementalBalanceEntry(runtime, input)
    })
  ],
  lifetime: { reserveRecharge: commitRechargeDuration }
});

/** Owns Elemental Dynamo tuning at its existing execution boundaries. */
const elementalDynamo = defineTrait({
  id: TRAIT.ELEMENTAL_DYNAMO,
  balance: {
    resourceGain: 1
  },
  triggers: [
    onTriggerPoint(evokerEntryObserved, {
      run: (runtime: ElementalistRuntime, input: ElementalistTransitionDelivery<ElementalistEntryTransition>) =>
        applyElementalDynamoEntry(runtime, input)
    })
  ]
});

/** Owns Specialized Elements tuning at its existing execution boundaries. */
const specializedElements = defineTrait({
  id: TRAIT.SPECIALIZED_ELEMENTS,
  balance: {
    rechargeMultiplier: 0.9,
    empoweredRechargeMultiplier: 0.8,
    maximumStacks: 6,
    playerStacks: 3
  },
  triggers: [
    onTriggerPoint(evokerInitialized, {
      run: (runtime: ElementalistRuntime) => initializeSpecializedElements(runtime)
    }),
    onTriggerPoint(familiarSettled, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applySpecializedElementsTrait(runtime, cast, cast.skill)
    })
  ],
  hooks: { availability: specializedElementsAvailability }
});

/** Familiar completion grants trait enchantments before the skill's resource settlement. */
function applyGalvanicEnchantment(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (skill.skillFamily === 'Familiar') {
    const profile = requireBalanceProfile(context.helpers, TRAIT.GALVANIC_ENCHANTMENT);
    grantElectricEnchantments(context, {
      at: cast.effectiveEnd,
      stacks: balanceProfileNumber(profile, 'playerStacks'),
      duration: balanceProfileNumber(profile, 'duration'),
      skill,
      traitId: TRAIT.GALVANIC_ENCHANTMENT
    });
  }
}

/** Owns Galvanic Enchantment tuning at its existing execution boundaries. */
const galvanicEnchantment = defineTrait({
  id: TRAIT.GALVANIC_ENCHANTMENT,
  balance: {
    // Trait and familiar grants consume the same Electric Enchantment pool.
    playerStacks: 2,
    duration: 6,
    effects: [
      { name: 'Galvanic Enchantment', type: 'strike', coefficient: 0.4, hits: 1 },
      { name: CONDITION.BURNING, type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 1.5 }
    ]
  },
  triggers: [
    onTriggerPoint(evokerCastCompleted, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyGalvanicEnchantment(runtime, cast, cast.skill)
    })
  ]
});

/** Owns Enhanced Potency tuning at its existing execution boundaries. */
const enhancedPotency = defineTrait({
  id: TRAIT.ENHANCED_POTENCY,
  balance: {
    criticalChance: 0.15,
    attributeBonuses: { ferocity: 75 },
    attributePerStack: 5
  },
  // Selection gates both elemental bonuses; live boons never become ordinary conversion inputs.
  attributes(context) {
    const config: ElementalistConfig | undefined = context.config;
    const profile = requireBalanceProfile(context.balanceContext.catalog, TRAIT.ENHANCED_POTENCY);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: ownerAttributeBonusNumber(profile, 'ferocity'),
          feedsConversions: 'none',
          enabled:
            config?.evokerElement === 'Air' &&
            (context.query?.furyActiveAt(context.time, context.runtime, context.event) ??
              boonActive(context, BOON.FURY))
        },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: elementalistMightStacks(context) * balanceProfileNumber(profile, 'attributePerStack'),
          feedsConversions: 'none',
          enabled: config?.evokerElement === 'Fire'
        }
      ]
    };
  },
  modifierRules: [
    {
      id: 'elementalist.enhanced-potency-air',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.ENHANCED_POTENCY, 'criticalChance'),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Air' &&
        Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ]
});

/** Owns Familiar's Prowess tuning at its existing execution boundaries. */
const familiarsProwess = defineTrait({
  id: TRAIT.FAMILIARS_PROWESS,
  balance: {
    baseDuration: 5,
    maximumStacks: 15,
    durationPerTier: 5,
    damageIncrease: 0.05,
    conditionDamageIncrease: 0.05
  },
  // Prowess applies the selected bonus once; Focus references these rules for its separate landing-page entry.
  modifierRules: [
    {
      requiresSelection: false,
      id: 'elementalist.familiars-prowess-strike',
      label: "Familiar's Prowess",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceNumber(
          context.catalog,
          hasTrait(context, TRAIT.FAMILIARS_FOCUS) ? TRAIT.FAMILIARS_FOCUS : TRAIT.FAMILIARS_PROWESS,
          'damageIncrease'
        ),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Air' && activeBuffStacks(context, 'familiars-prowess', 1) > 0
    },
    {
      requiresSelection: false,
      id: 'elementalist.familiars-prowess-condition',
      label: "Familiar's Prowess",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceNumber(
          context.catalog,
          hasTrait(context, TRAIT.FAMILIARS_FOCUS) ? TRAIT.FAMILIARS_FOCUS : TRAIT.FAMILIARS_PROWESS,
          'conditionDamageIncrease'
        ),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Fire' && activeBuffStacks(context, 'familiars-prowess', 1) > 0
    }
  ],
  triggers: [
    onTriggerPoint(evokerCastCompleted, {
      when: (_runtime: unknown, { cast }: ElementalistCastCompleted) => cast.skill.skillFamily === 'Familiar',
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        grantFamiliarProwess(runtime, cast, cast.skill)
    })
  ]
});

/** Owns Altruistic Aspect tuning at its existing execution boundaries. */
const altruisticAspect = defineTrait({
  id: TRAIT.ALTRUISTIC_ASPECT,
  balance: {
    effects: [
      boon("Fox's Fury", BOON.MIGHT, 3, 10),
      boon("Hare's Agility", BOON.FURY, 1, 5),
      boon("Toad's Fortitude", BOON.STABILITY, 1, 5),
      boon('Elemental Procession', BOON.RESISTANCE, 1, 5)
    ]
  },
  triggers: [
    onTriggerPoint(evokerCastSettled, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyAltruisticAspect(runtime, cast, cast.skill)
    })
  ]
});

/** Focus supplies the improved Prowess values and references its shared damage rules. */
const familiarsFocus = defineTrait({
  id: TRAIT.FAMILIARS_FOCUS,
  modifierReferences: [
    { ruleId: 'elementalist.familiars-prowess-strike', qualifier: "Improves Familiar's Prowess" },
    { ruleId: 'elementalist.familiars-prowess-condition', qualifier: "Improves Familiar's Prowess" }
  ],
  balance: {
    damageIncrease: 0.12,
    conditionDamageIncrease: 0.1
  }
});

/** Owns Familiar's Blessing tuning at its existing execution boundaries. */
const familiarsBlessing = defineTrait({
  id: TRAIT.FAMILIARS_BLESSING,
  balance: {
    effects: [boon(BOON.QUICKNESS, BOON.QUICKNESS, 1, 1.75), boon(BOON.ALACRITY, BOON.ALACRITY, 1, 4)]
  },
  triggers: [
    onTriggerPoint(evokerCastCompleted, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        grantFamiliarBlessing(runtime, cast, cast.skill)
    })
  ]
});

/** Fiery Might multiplies strikes against burning targets when selected. */
const fieryMight = defineTrait({
  id: TRAIT.FIERY_MIGHT,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      id: 'elementalist.fiery-might',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumber(context.catalog, TRAIT.FIERY_MIGHT, 'damageMultiplier'),
      when: (context) => targetConditionActive(context, CONDITION.BURNING)
    }
  ]
});

/** Register evoker traits in their existing execution order. */
export const evokerTraits = [
  evocation,
  fieryMight,
  familiarsProwess,
  enhancedPotency,
  altruisticAspect,
  familiarsFocus,
  familiarsBlessing,
  elementalDynamo,
  galvanicEnchantment,
  elementalBalance,
  specializedElements
];

/** Accepted Burning in Fire consumes Evocation's Might interval only when its reward survives. */
function applyEvocationBurning(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context.profession);

  if (event.type === 'condition' && event.condition === CONDITION.BURNING && state.element === 'Fire') {
    const evocationProfile = requireBalanceProfile(context.helpers, TRAIT.EVOCATION);
    const might = requireEffect(evocationProfile, 'boon', 'Fire Familiar');
    const sourceId = event.skillId ?? event.sourceId;

    if (
      might &&
      context.procs.claimCooldown(
        'elementalist.evoker.ignitePassive',
        event.at,
        balanceNumber(context.helpers, TRAIT.EVOCATION, 'pulseInterval')
      )
    ) {
      emitTraitProfile(context, TRAIT.EVOCATION, TRAIT.EVOCATION, undefined, {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'boon', name: 'Fire Familiar' },
        attribution: {
          source: 'Fire Familiar',
          sourceId: sourceId,
          actorType: ACTOR.PLAYER,
          skillName: 'Fire Familiar',
          skillId: elementalistEventSkill(context, 'Fire Familiar', sourceId).id,
          name: 'Fire Familiar'
        }
      });
    }
  }
}

/** Entry cycles arm Elemental Balance before Dynamo grants the resulting familiar charge. */
function applyElementalBalanceEntry(
  context: ElementalistRuntime,
  { transition, cause }: ElementalistTransitionDelivery<ElementalistEntryTransition>
): void {
  const state = evokerState.from(context.profession);

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (transition.to !== state.element) return;

  {
    const elementalBalanceProfile = requireBalanceProfile(context.helpers, TRAIT.ELEMENTAL_BALANCE);
    const threshold = balanceProfileNumber(elementalBalanceProfile, 'threshold');
    // Completing the selected-attunement entry cycle arms the reward and starts the next cycle at zero.
    const progress = advanceCounter(state.elementalBalanceProgress, 1, threshold, 'reset');
    state.elementalBalanceProgress = progress.value;

    if (progress.reached) {
      // Temporary-effect expiry uses the absolute combat tick, including patched durations.
      const duration = balanceProfileNumber(elementalBalanceProfile, 'duration');
      state.elementalBalanceUntil = gw2EffectExpiresAt(transition.at, duration);
      context.effects.emit({
        cause,
        ...elementalistAnnouncement({
          at: transition.at,
          name: 'Elemental Balance',
          procType: 'skill',
          sourceId: transition.sourceId,
          sourceSkill: transition.source,
          detail: `CDR armed (${duration}s)`,
          icon: new URL('@images/wiki/elemental-balance.png', import.meta.url).href
        })
      });
    }
  }
}

/** Accepted entries into the familiar element grant one profiled Dynamo charge. */
function applyElementalDynamoEntry(
  context: ElementalistRuntime,
  { transition, cause }: ElementalistTransitionDelivery<ElementalistEntryTransition>
): void {
  const state = evokerState.from(context.profession);

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (transition.to !== state.element) return;
  // Elemental Dynamo turns each entry into familiar charges and reports the new total

  context.resourceController.grant(
    'familiarCharges',
    balanceNumber(context.helpers, TRAIT.ELEMENTAL_DYNAMO, 'resourceGain')
  );
  context.effects.emit({
    kind: 'packet',
    cause,
    event: {
      type: 'resource',
      at: transition.at,
      source: 'Elemental Dynamo',
      sourceId: transition.sourceId,
      actorType: ACTOR.PLAYER,
      skillName: 'Elemental Dynamo',
      kind: 'evoker-charges',
      value: state.familiarCharges.value,
      maximum: state.familiarCharges.maximum,
      empowered: state.empoweredCharges.value
    }
  });
}

// Specialized Elements removes the profiled fraction of each weapon skill's base recharge.
function applyWeaponSkillRechargeMultiplier(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  multiplier: number
): void {
  const at = cast.effectiveEnd;
  for (const candidate of context.helpers.skills) {
    if (candidate.type !== 'Weapon') continue;

    const reduction = gw2BaseRecharge(candidate) * Math.max(0, 1 - multiplier);
    context.cooldownController.reduceSkillRecharge(candidate, reduction, at);
  }
}

function applySpecializedElementsTrait(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const familiarElement = skill.skillFamily === 'Familiar' ? (skill.attunement as ElementalistAttunement) : undefined;

  // Basic familiars retain 90% weapon recharge; empowered familiars retain
  // 67% and trigger the elemental entry effects.
  if (familiarElement) {
    const basic = skill.flipSkillId != null;
    applyWeaponSkillRechargeMultiplier(
      context,
      cast,
      balanceNumber(
        context.helpers,
        TRAIT.SPECIALIZED_ELEMENTS,
        basic ? 'rechargeMultiplier' : 'empoweredRechargeMultiplier'
      )
    );

    if (!basic) {
      reenterEvokerAttunement(context, cast, skill, familiarElement);
    }
  }
}

/** Pin Core's element after the resource initializer has clamped its seeded charges. */
function initializeSpecializedElements(context: ElementalistRuntime): void {
  professionCoreState(context.profession).primaryAttunement = evokerState.from(context.profession).element;
}

/** Meditation skills whose named profile effects grant Altruistic Aspect boons. */
const ALTRUISTIC_ASPECT_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.FOXS_FURY,
  ID.HARES_AGILITY,
  ID.TOADS_FORTITUDE,
  ID.ELEMENTAL_PROCESSION
]);

/**
 * Grants Altruistic Aspect's per-meditation boon when the trait is slotted and
 * the completing skill is one of the four it covers; otherwise a no-op.
 */
function applyAltruisticAspect(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (!ALTRUISTIC_ASPECT_SKILLS.has(skill.id)) return;

  const altruisticAspectProfile = requireBalanceProfile(context.helpers, TRAIT.ALTRUISTIC_ASPECT);
  const effect = requireEffect(altruisticAspectProfile, 'boon', skill.name);

  if (effect) {
    emitTraitProfile(context, TRAIT.ALTRUISTIC_ASPECT, TRAIT.ALTRUISTIC_ASPECT, undefined, {
      at: cast.effectiveEnd,
      fullEnd: cast.effectiveEnd,
      effect: { type: 'boon', name: skill.name },
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: {
        source: skill.name,
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        skillName: skill.name,
        skillId: skill.id,
        name: skill.name
      }
    });
  }
}

// refreshes the Familiar's Prowess damage buff, extending an active one rather than stacking a second
function grantFamiliarProwess(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const at = cast.effectiveEnd;
  const familiarsProwessProfile = requireBalanceProfile(context.helpers, TRAIT.FAMILIARS_PROWESS);
  const baseDuration = balanceProfileNumber(familiarsProwessProfile, 'baseDuration');
  const extension = balanceProfileNumber(familiarsProwessProfile, 'durationPerTier');
  const maximumDuration = balanceProfileNumber(familiarsProwessProfile, 'maximumStacks');
  const current = activeElementalistBuffs(context, 'familiars-prowess', at).at(-1);

  if (current) {
    refreshElementalistBuffs(context, 'familiars-prowess', at, (expiry) =>
      Math.min(expiry + extension, at + maximumDuration)
    );
    return;
  }

  context.effects.emit(
    elementalistBuffRequest(
      {
        at,
        source: "Familiar's Prowess",
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillName: "Familiar's Prowess",
        kind: 'familiars-prowess',
        stacks: 1,
        duration: baseDuration
      },
      { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
    )
  );
}

/** Familiar's Blessing grants the completed familiar's element to the party after Prowess. */
function grantFamiliarBlessing(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const at = cast.effectiveEnd;
  const familiarElement = skill.skillFamily === 'Familiar' ? (skill.attunement as ElementalistAttunement) : undefined;

  if (familiarElement) {
    // Blessing reaches the five-person party so ally boon generation and uptime include familiar grants.
    emitTraitProfile(context, TRAIT.FAMILIARS_BLESSING, TRAIT.FAMILIARS_BLESSING, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'boon', name: familiarBlessingName(familiarElement) },
      skillId: skill.id,
      skillName: "Familiar's Blessing",
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.FAMILIARS_BLESSING,
        actorType: ACTOR.PLAYER,
        name: "Familiar's Blessing",
        priority: 0,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    });
  }
}
