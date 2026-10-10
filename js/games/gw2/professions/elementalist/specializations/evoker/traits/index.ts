import { type ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { elementalistMightStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, targetConditionActive, boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistAnnouncement,
  elementalistEventSkill
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import type { ElementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { reenterEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS,
  EVOKER_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
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
import { familiarBlessingName } from '#gw2/professions/elementalist/specializations/evoker/traits/familiar-blessing.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';

import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  commitRechargeDuration,
  specializedElementsAvailability
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';

const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

/** Owns Evocation tuning at its existing execution boundaries. */
export const evocation = defineTrait({
  triggers: [
    onTriggerPoint(evokerEventAccepted, {
      requiresSelection: false,
      run: (runtime: ElementalistRuntime, { event }: EvokerEvent) => applyEvocationBurning(runtime, event)
    })
  ],
  id: TRAIT.EVOCATION,
  name: 'Evocation',
  balance: {
    internalCooldown: 5,
    effects: [boon('Fire Familiar', 'might', 1, 6)]
  }
});

/** Owns Elemental Balance tuning at its existing execution boundaries. */
export const elementalBalance = defineTrait({
  triggers: [
    onTriggerPoint(evokerEntryObserved, {
      run: (runtime: ElementalistRuntime, { event }: EvokerEvent) => applyElementalBalanceEntry(runtime, event)
    })
  ],
  id: TRAIT.ELEMENTAL_BALANCE,
  name: 'Elemental Balance',
  balance: {
    threshold: 2,
    durationMultiplier: 5,
    rechargeMultiplier: 0.34
  },
  lifetime: { reserveRecharge: commitRechargeDuration }
});

/** Owns Elemental Dynamo tuning at its existing execution boundaries. */
export const elementalDynamo = defineTrait({
  triggers: [
    onTriggerPoint(evokerEntryObserved, {
      run: (runtime: ElementalistRuntime, { event }: EvokerEvent) => applyElementalDynamoEntry(runtime, event)
    })
  ],
  id: TRAIT.ELEMENTAL_DYNAMO,
  name: 'Elemental Dynamo',
  balance: {
    resourceGain: 1
  }
});

/** Owns Specialized Elements tuning at its existing execution boundaries. */
export const specializedElements = defineTrait({
  triggers: [
    onTriggerPoint(evokerInitialized, {
      run: (runtime: ElementalistRuntime) => initializeSpecializedElements(runtime)
    }),
    onTriggerPoint(familiarSettled, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applySpecializedElementsTrait(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.SPECIALIZED_ELEMENTS,
  name: 'Specialized Elements',
  balance: {
    rechargeMultiplier: 0.9,
    empoweredRechargeMultiplier: 0.67,
    maximumStacks: 6,
    playerStacks: 3
  },
  hooks: { availability: specializedElementsAvailability }
});

/** Familiar completion grants trait enchantments before the skill's resource settlement. */
function applyGalvanicEnchantment(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  if (FAMILIAR_ELEMENTS.has(skill.id)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.GALVANIC_ENCHANTMENT);
    grantElectricEnchantments(context, {
      at: cast.effectiveEnd,
      stacks: balanceProfileNumber(profile, 'playerStacks'),
      duration: balanceProfileNumber(profile, 'durationMultiplier'),
      skill,
      procType: 'trait'
    });
  }
}

/** Owns Galvanic Enchantment tuning at its existing execution boundaries. */
export const galvanicEnchantment = defineTrait({
  triggers: [
    onTriggerPoint(evokerCastCompleted, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyGalvanicEnchantment(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.GALVANIC_ENCHANTMENT,
  name: 'Galvanic Enchantment',
  balance: {
    // Trait and familiar grants consume the same Electric Enchantment pool.
    damagePreviewAttribution: 'shared',
    playerStacks: 2,
    durationMultiplier: 6,
    effects: [
      { name: 'Galvanic Enchantment', type: 'strike', coefficient: 0.4, hits: 1 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 1.5 }
    ]
  }
});

/** Owns Enhanced Potency tuning at its existing execution boundaries. */
export const enhancedPotency = defineTrait({
  // Selection gates both elemental bonuses; live boons never become ordinary conversion inputs.
  attributes(context) {
    const config: ElementalistConfig | undefined = context.config;
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.ENHANCED_POTENCY);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled:
            config?.evokerElement === 'Air' &&
            (context.query?.furyActiveAt(context.time, context.runtime, context.event) ?? boonActive(context, 'fury'))
        },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: elementalistMightStacks(context) * balanceProfileNumber(profile, 'attributePerStack'),
          feedsConversions: false,
          enabled: config?.evokerElement === 'Fire'
        }
      ]
    };
  },

  id: TRAIT.ENHANCED_POTENCY,
  name: 'Enhanced Potency',
  balance: {
    criticalChance: 0.15,
    attributeBonus: 75,
    attributePerStack: 5
  },
  modifierRules: [
    {
      id: 'elementalist.enhanced-potency-air',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ENHANCED_POTENCY), 'criticalChance'),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Air' &&
        Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ]
});

/** Owns Familiar's Prowess tuning at its existing execution boundaries. */
export const familiarsProwess = defineTrait({
  triggers: [
    onTriggerPoint(evokerCastCompleted, {
      when: (_runtime: unknown, { cast }: ElementalistCastCompleted) => FAMILIAR_ELEMENTS.has(cast.skill.id),
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        grantFamiliarProwess(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.FAMILIARS_PROWESS,
  name: "Familiar's Prowess",
  balance: {
    durationMultiplier: 5,
    maximumStacks: 15,
    durationPerTier: 5,
    damageIncrease: 0.05,
    conditionDamageIncrease: 0.05
  },
  // Applied Prowess supplies the window; the selected trait's balance owns each damage bonus.
  modifierRules: [
    {
      requiresSelection: false,
      id: 'elementalist.familiars-prowess-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(
            context,
            hasTrait(context, TRAIT.FAMILIARS_FOCUS) ? TRAIT.FAMILIARS_FOCUS : TRAIT.FAMILIARS_PROWESS
          ),
          'damageIncrease'
        ),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Air' && activeBuffStacks(context, 'familiars-prowess', 1) > 0
    },
    {
      requiresSelection: false,
      id: 'elementalist.familiars-prowess-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(
            context,
            hasTrait(context, TRAIT.FAMILIARS_FOCUS) ? TRAIT.FAMILIARS_FOCUS : TRAIT.FAMILIARS_PROWESS
          ),
          'conditionDamageIncrease'
        ),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Fire' && activeBuffStacks(context, 'familiars-prowess', 1) > 0
    }
  ]
});

/** Owns Altruistic Aspect tuning at its existing execution boundaries. */
export const altruisticAspect = defineTrait({
  triggers: [
    onTriggerPoint(evokerCastSettled, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        applyAltruisticAspect(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.ALTRUISTIC_ASPECT,
  name: 'Altruistic Aspect',
  balance: {
    effects: [
      boon("Fox's Fury", 'might', 3, 10),
      boon("Hare's Agility", 'fury', 1, 5),
      boon("Toad's Fortitude", 'stability', 1, 5),
      boon('Elemental Procession', 'resistance', 1, 5)
    ]
  }
});

/** Focus owns its replacement bonuses; Prowess modifiers consume them during the applied window. */
export const familiarsFocus = defineTrait({
  id: TRAIT.FAMILIARS_FOCUS,
  name: "Familiar's Focus",
  balance: {
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.1
  }
});

/** Owns Familiar's Blessing tuning at its existing execution boundaries. */
export const familiarsBlessing = defineTrait({
  triggers: [
    onTriggerPoint(evokerCastCompleted, {
      run: (runtime: ElementalistRuntime, { cast }: ElementalistCastCompleted) =>
        grantFamiliarBlessing(runtime, cast, cast.skill)
    })
  ],
  id: TRAIT.FAMILIARS_BLESSING,
  name: "Familiar's Blessing",
  balance: {
    effects: [boon('Quickness', 'quickness', 1, 1.75), boon('Alacrity', 'alacrity', 1, 4)]
  }
});

/** Fiery Might multiplies strikes against burning targets when selected. */
export const fieryMight = defineTrait({
  id: TRAIT.FIERY_MIGHT,
  name: 'Fiery Might',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      id: 'elementalist.fiery-might',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FIERY_MIGHT), 'damageMultiplier'),
      when: (context) => targetConditionActive(context, 'Burning')
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

/** Accepted Burning in Fire consumes Ignite's existing pulse interval only when its Might packet survives. */
function applyEvocationBurning(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const state = evokerState.from(context);
  if (event.type === 'condition' && event.condition === 'Burning' && state.element === 'Fire') {
    const evocationProfile = requireBalanceProfileFromContext(context, TRAIT.EVOCATION);
    const might = requireEffect(evocationProfile, 'boon', 'Fire Familiar');
    const sourceId = event.skillId ?? event.sourceId;
    if (
      might &&
      context.procs.claimCooldown(
        'elementalist.evoker.ignitePassive',
        event.at,
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.ignite), 'pulseInterval')
      )
    ) {
      emitTraitProfile(context, TRAIT.EVOCATION, TRAIT.EVOCATION, undefined, {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'boon', name: 'Fire Familiar' },
        cast: emissionCast,
        attribution: {
          source: 'Fire Familiar',
          sourceId: sourceId,
          actorType: 'player',
          skillName: 'Fire Familiar',
          skillId: elementalistEventSkill(context, 'Fire Familiar', sourceId).id,
          name: 'Fire Familiar'
        }
      });
    }
  }
}

/** Entry cycles arm Elemental Balance before Dynamo grants the resulting familiar charge. */
function applyElementalBalanceEntry(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  // everything past this point is an attunement-entry trait
  if (event.type !== 'elementalist.attunement' && event.type !== 'elementalist.attunement-enter') {
    return;
  }

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (event.to !== state.element) return;
  {
    const elementalBalanceProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_BALANCE);
    const threshold = balanceProfileNumber(elementalBalanceProfile, 'threshold');
    // Completing the selected-attunement entry cycle arms the reward and starts the next cycle at zero.
    const progress = advanceCounter(state.elementalBalanceProgress, 1, threshold, 'reset');
    state.elementalBalanceProgress = progress.value;
    if (progress.reached) {
      // Temporary-effect expiry uses the absolute combat tick, including patched durations.
      const duration = balanceProfileNumber(elementalBalanceProfile, 'durationMultiplier');
      state.elementalBalanceUntil = gw2EffectExpiresAt(event.at, duration);
      context.effects.emit(
        elementalistAnnouncement({
          at: event.at,
          name: 'Elemental Balance',
          procType: 'skill',
          sourceId: event.skillId ?? event.sourceId,
          sourceSkill: event.skillName || event.source || '',
          detail: `CDR armed (${duration}s)`,
          icon: 'https://wiki.guildwars2.com/images/4/4c/Elemental_Balance.png'
        })
      );
    }
  }
}

/** Accepted entries into the familiar element grant one profiled Dynamo charge. */
function applyElementalDynamoEntry(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  // everything past this point is an attunement-entry trait
  if (event.type !== 'elementalist.attunement' && event.type !== 'elementalist.attunement-enter') {
    return;
  }

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (event.to !== state.element) return;
  // Elemental Dynamo turns each entry into familiar charges and reports the new total

  const elementalDynamoProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_DYNAMO);
  context.resourceController.grant('familiarCharges', balanceProfileNumber(elementalDynamoProfile, 'resourceGain'));
  context.effects.emit({
    kind: 'packet',
    cause: event,
    event: {
      type: 'resource',
      at: event.at,
      source: 'Elemental Dynamo',
      sourceId: event.sourceId,
      actorType: 'player',
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
  skill: Skill
): void {
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  // Basic familiars retain 90% weapon recharge; empowered familiars retain
  // 67% and trigger the elemental entry effects.
  if (familiarElement) {
    const basic = BASIC_FAMILIARS.has(skill.id);
    applyWeaponSkillRechargeMultiplier(
      context,
      cast,
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.SPECIALIZED_ELEMENTS),
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
  professionCoreState(context).primaryAttunement = evokerState.from(context).element;
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
  const altruisticAspectProfile = requireBalanceProfileFromContext(context, TRAIT.ALTRUISTIC_ASPECT);
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
        actorType: 'player',
        audience: { recipients: 'party', maximumRecipients: 5 },
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
  const familiarsProwessProfile = requireBalanceProfileFromContext(context, TRAIT.FAMILIARS_PROWESS);
  const baseDuration = balanceProfileNumber(familiarsProwessProfile, 'durationMultiplier');
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
        actorType: 'player',
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
function grantFamiliarBlessing(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const at = cast.effectiveEnd;
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
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
        actorType: 'player',
        name: "Familiar's Blessing",
        priority: 0,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    });
  }
}
