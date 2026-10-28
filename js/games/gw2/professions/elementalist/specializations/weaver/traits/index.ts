import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { type ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { primaryAttunement } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  attributeBonusNumber,
  balanceNumberFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { weaverDualAttunements } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import {
  weaverAttunementCompleted,
  weaverCastCompleted,
  weaverHandsChanged,
  weaverUnraveled,
  type WeaverCastCompleted,
  type WeaverTransition,
  type WeaverUnraveled
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/trigger-points.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';

import { elementsOfRageAvailability } from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';

const elementalRefreshment = defineTrait({
  name: 'Elemental Refreshment',
  id: TRAIT.ELEMENTAL_REFRESHMENT,
  balance: { attributeBonuses: { vitality: 180 } },
  attributes: traitAttributeEffects(TRAIT.ELEMENTAL_REFRESHMENT, [
    // Intrinsic Vitality feeds both consumables and Reinforced Armor before converted bonuses are applied.
    { kind: 'flat', to: 'Vitality', feedsConversions: 'all' }
  ])
});

const elementalPolyphony = defineTrait({
  name: 'Elemental Polyphony',
  id: TRAIT.ELEMENTAL_POLYPHONY,
  balance: {
    attributeBonuses: { power: 200, ferocity: 200, healingPower: 200, conditionDamage: 200 }
  },
  // Each distinct active attunement contributes once, including configured hands before runtime exists.
  attributes(context) {
    const config: ElementalistConfig | undefined = context.config;
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.ELEMENTAL_POLYPHONY);
    const active = new Set([primaryAttunement(context)]);
    const secondary =
      readProfessionSpecializationState<{ secondaryAttunement?: string }>(context.runtime?.profession, 'Weaver')
        ?.secondaryAttunement ?? config?.secondaryAttunement;

    if (typeof secondary === 'string') active.add(secondary);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: attributeBonusNumber(profile, 'power'),
          feedsConversions: 'none',
          enabled: active.has('Fire')
        },
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: attributeBonusNumber(profile, 'ferocity'),
          feedsConversions: 'none',
          enabled: active.has('Air')
        },
        {
          kind: 'flat',
          to: 'Healing Power',
          amount: attributeBonusNumber(profile, 'healingPower'),
          feedsConversions: 'none',
          enabled: active.has('Water')
        },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: attributeBonusNumber(profile, 'conditionDamage'),
          feedsConversions: 'none',
          enabled: active.has('Earth')
        }
      ]
    };
  }
});

const superiorElements = defineTrait({
  name: 'Superior Elements',
  id: TRAIT.SUPERIOR_ELEMENTS,
  balance: {
    criticalChance: 0.2,
    internalCooldown: 4,
    effects: [
      {
        type: 'condition',
        name: CONDITION.WEAKNESS,
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5
      }
    ]
  },
  modifierRules: [
    {
      id: 'elementalist.superior-elements',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.SUPERIOR_ELEMENTS, 'criticalChance'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, CONDITION.WEAKNESS)
    }
  ],
  triggers: [onTriggerPoint(weaverCastCompleted, { run: applySuperiorElements })]
});

const elementalPursuit = defineTrait({
  name: 'Elemental Pursuit',
  id: TRAIT.ELEMENTAL_PURSUIT,
  balance: {
    effects: [{ type: 'boon', name: BOON.SWIFTNESS, boon: BOON.SWIFTNESS, stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      emit: TRAIT.ELEMENTAL_PURSUIT,
      on: 'control.resolved',
      when: (_runtime, event) => event.type === 'control' && event.actorType === ACTOR.PLAYER,
      effects: (effect) => effect.type === 'boon' && effect.name === BOON.SWIFTNESS,
      attribution: (runtime, event) => ({
        source: 'Elemental Pursuit',
        sourceId: event.skillId ?? event.sourceId,
        skillId: elementalistEventSkill(runtime, 'Elemental Pursuit', event.skillId ?? event.sourceId).id,
        skillName: 'Elemental Pursuit',
        actorType: ACTOR.PLAYER,
        name: 'Elemental Pursuit',
        priority: 0
      })
    }
  ]
});

const weaversProwess = defineTrait({
  name: "Weaver's Prowess",
  id: TRAIT.WEAVERS_PROWESS,
  balance: {
    effects: [{ type: 'boon', name: BOON.RESISTANCE, boon: BOON.RESISTANCE, stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(weaverAttunementCompleted, {
      run: (runtime: ElementalistRuntime, { event }: WeaverTransition) => applyWeaversProwess(runtime, event)
    })
  ]
});

const swiftRevenge = defineTrait({
  name: 'Swift Revenge',
  id: TRAIT.SWIFT_REVENGE,
  balance: {
    resourceGain: 25,
    effects: [
      { type: 'boon', name: 'Fire', boon: BOON.MIGHT, stacks: 3, duration: 5 },
      { type: 'boon', name: 'Air', boon: BOON.SWIFTNESS, stacks: 1, duration: 5 }
    ]
  },
  triggers: [onTriggerPoint(weaverCastCompleted, { run: applySwiftRevenge })]
});

const bolsteredElements = defineTrait({
  name: 'Bolstered Elements',
  id: TRAIT.BOLSTERED_ELEMENTS,
  balance: {
    effects: [{ type: 'boon', name: BOON.PROTECTION, boon: BOON.PROTECTION, stacks: 1, duration: 3 }]
  },
  triggers: [onTriggerPoint(weaverCastCompleted, { run: applyBolsteredElements })]
});

const elementsOfRage = defineTrait({
  name: 'Elements of Rage',
  id: TRAIT.ELEMENTS_OF_RAGE,
  balance: {
    damageIncrease: 0.15,
    conditionDamageIncrease: 0.1,
    duration: 8
  },
  modifierRules: [
    {
      id: 'elementalist.elements-of-rage-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.ELEMENTS_OF_RAGE, 'damageIncrease'),
      when: (context) => activeBuffStacks(context, 'elements of rage', 1) > 0
    },
    {
      id: 'elementalist.elements-of-rage-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.ELEMENTS_OF_RAGE, 'conditionDamageIncrease'),
      when: (context) => activeBuffStacks(context, 'elements of rage', 1) > 0
    }
  ],
  triggers: [
    onTriggerPoint(weaverHandsChanged, {
      run: (runtime: ElementalistRuntime, { event }: WeaverTransition) => applyElementsOfRageAttunement(runtime, event)
    }),
    onTriggerPoint(weaverUnraveled, {
      run: (runtime: ElementalistRuntime, { cast, previousPrimary, previousSecondary }: WeaverUnraveled) =>
        applyUnravelElementsOfRage(runtime, cast, previousPrimary, previousSecondary)
    })
  ],
  hooks: { availability: elementsOfRageAvailability }
});

const flowState = defineTrait({
  name: 'Flow State',
  id: TRAIT.FLOW_STATE,
  balance: {
    rechargeReduction: 1, // flat seconds removed from attunement recharge
    rechargeMultiplier: 0.8 // fraction of dual-skill recharge retained
  },
  rechargeRules: [
    {
      when: (_context, skill) => String(skill.slot) === 'Weapon_3' && Boolean(weaverDualAttunements(skill)),
      multiplier: { profile: TRAIT.FLOW_STATE, field: 'rechargeMultiplier' }
    }
  ]
});

/** Register weaver traits in their existing execution order. */
export const weaverTraits = [
  elementalRefreshment,
  elementalPolyphony,
  superiorElements,
  elementalPursuit,
  weaversProwess,
  swiftRevenge,
  bolsteredElements,
  elementsOfRage,
  flowState
];

/** Fully attuned setup swaps may carry Rage into combat before Weave Self observes the transition. */
function applyElementsOfRageAttunement(context: ElementalistRuntime, event: SimulationEvent): void {
  const at = event.at,
    target = event.to,
    previous = event.from,
    sourceId = event.skillId ?? event.sourceId,
    source = event.skillName || event.source || 'Attunement',
    unravelActive = weaverState.from(context).unravelUntil > at;

  if (target === previous || unravelActive) {
    context.effects.emit(
      elementalistBuffRequest({
        skill: elementalistEventSkill(context, source, sourceId),
        at,
        source,
        sourceId,
        actorType: ACTOR.PLAYER,
        kind: 'elements of rage',
        stacks: 1,
        duration: balanceNumberFromContext(context, TRAIT.ELEMENTS_OF_RAGE, 'duration'),
        skillName: source
      })
    );
  }
}

/** Resistance follows the in-combat transition and precedes Core's Bountiful Power accounting. */
function applyWeaversProwess(context: ElementalistRuntime, event: SimulationEvent): void {
  const at = event.at,
    target = event.to,
    previous = event.from,
    sourceId = event.skillId ?? event.sourceId,
    unravelActive = weaverState.from(context).unravelUntil > at;

  if (unravelActive || target === previous) {
    const weaversProwessProfile = requireBalanceProfileFromContext(context, TRAIT.WEAVERS_PROWESS);
    const resistance = requireEffect(weaversProwessProfile, 'boon', BOON.RESISTANCE);

    if (resistance) {
      emitTraitProfile(context, TRAIT.WEAVERS_PROWESS, TRAIT.WEAVERS_PROWESS, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: BOON.RESISTANCE },
        attribution: {
          source: "Weaver's Prowess",
          sourceId: sourceId,
          actorType: ACTOR.PLAYER,
          skillName: "Weaver's Prowess",
          skillId: elementalistEventSkill(context, "Weaver's Prowess", sourceId).id,
          name: "Weaver's Prowess"
        }
      });
    }
  }
}

/** Stances grant Protection before dual-skill rewards. */
function applyBolsteredElements(context: ElementalistRuntime, { cast }: WeaverCastCompleted): void {
  const skill = cast.skill,
    at = cast.effectiveEnd;

  if (skill.skillFamily === 'Stance') {
    emitTraitProfile(context, TRAIT.BOLSTERED_ELEMENTS, TRAIT.BOLSTERED_ELEMENTS, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'boon', name: BOON.PROTECTION },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BOLSTERED_ELEMENTS,
        actorType: ACTOR.PLAYER,
        name: skill.name,
        priority: 0
      }
    });
  }
}

/** Each captured dual element grants its own Swift Revenge benefit. */
function applySwiftRevenge(context: ElementalistRuntime, { cast, dualAttunements }: WeaverCastCompleted): void {
  const skill = cast.skill,
    at = cast.effectiveEnd;

  if (dualAttunements) {
    for (const element of dualAttunements) {
      if (element === 'Fire') {
        emitTraitProfile(context, TRAIT.SWIFT_REVENGE, TRAIT.SWIFT_REVENGE, undefined, {
          at: at,
          fullEnd: at,
          effect: { type: 'boon', name: 'Fire' },
          skillId: skill.id,
          skillName: skill.name,
          cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
          priority: 0,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.SWIFT_REVENGE,
            actorType: ACTOR.PLAYER,
            name: skill.name,
            priority: 0
          }
        });
      } else if (element === 'Air') {
        emitTraitProfile(context, TRAIT.SWIFT_REVENGE, TRAIT.SWIFT_REVENGE, undefined, {
          at: at,
          fullEnd: at,
          effect: { type: 'boon', name: 'Air' },
          skillId: skill.id,
          skillName: skill.name,
          cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
          priority: 0,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.SWIFT_REVENGE,
            actorType: ACTOR.PLAYER,
            name: skill.name,
            priority: 0
          }
        });
      } else if (element === 'Earth') {
        context.endurance.grant(balanceNumberFromContext(context, TRAIT.SWIFT_REVENGE, 'resourceGain'));
      }
    }
  }
}

/** Accepted dual attacks claim Superior Elements before emitting Weakness. */
function applySuperiorElements(context: ElementalistRuntime, { cast, dualAttunements }: WeaverCastCompleted): void {
  const skill = cast.skill,
    at = cast.effectiveEnd;

  if (dualAttunements && context.procs.claim(TRAIT.SUPERIOR_ELEMENTS, 'elementalist.weaver.superiorElements', at)) {
    emitTraitProfile(context, TRAIT.SUPERIOR_ELEMENTS, TRAIT.SUPERIOR_ELEMENTS, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: CONDITION.WEAKNESS },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: { source: skill.name, sourceId: skill.id, actorType: ACTOR.PLAYER, triggeredBy: '' },
      transform: (event) => ({ ...event, name: skill.name + ' \u2014 ' + event.condition })
    });
  }
}

/** Unravel rewards the transition from split hands after its boons and recharge resets. */
function applyUnravelElementsOfRage(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  previousPrimary: string,
  previousSecondary: string | null
): void {
  const skill = cast.skill;

  if (previousPrimary !== previousSecondary) {
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at: cast.effectiveEnd,
          source: skill.name,
          sourceId: skill.id,
          actorType: ACTOR.PLAYER,
          name: skill.name,
          kind: 'elements of rage',
          duration: balanceNumberFromContext(context, TRAIT.ELEMENTS_OF_RAGE, 'duration'),
          stacks: 1
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }
}
