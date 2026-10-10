import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  balanceProfileNumber,
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
  weaverHandsInitialized,
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

export const elementalRefreshment = defineTrait({
  id: TRAIT.ELEMENTAL_REFRESHMENT,
  name: 'Elemental Refreshment',
  balance: { attributeBonus: 180 },
  buildAttributes: traitAttributeEffects(TRAIT.ELEMENTAL_REFRESHMENT, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const elementalPolyphony = defineTrait({
  id: TRAIT.ELEMENTAL_POLYPHONY,
  name: 'Elemental Polyphony',
  balance: {
    attributeBonus: 200
  }
});

export const superiorElements = defineTrait({
  triggers: [onTriggerPoint(weaverCastCompleted, { run: applySuperiorElements })],
  id: TRAIT.SUPERIOR_ELEMENTS,
  name: 'Superior Elements',
  balance: {
    criticalChance: 0.2,
    internalCooldown: 4,
    effects: [
      {
        type: 'condition',
        name: 'Weakness',
        condition: 'Weakness',
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SUPERIOR_ELEMENTS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Weakness')
    }
  ]
});

export const elementalPursuit = defineTrait({
  id: TRAIT.ELEMENTAL_PURSUIT,
  name: 'Elemental Pursuit',
  balance: {
    effects: [{ type: 'boon', name: 'Swiftness', boon: 'swiftness', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      emit: TRAIT.ELEMENTAL_PURSUIT,
      on: 'control.resolved',
      when: (_runtime, event) => event.type === 'control' && event.actorType === 'player',
      effects: (effect) => effect.type === 'boon' && effect.name === 'Swiftness',
      attribution: (runtime, event) => ({
        source: 'Elemental Pursuit',
        sourceId: event.skillId ?? event.sourceId,
        skillId: elementalistEventSkill(runtime, 'Elemental Pursuit', event.skillId ?? event.sourceId).id,
        skillName: 'Elemental Pursuit',
        actorType: 'player',
        name: 'Elemental Pursuit',
        priority: 0
      })
    }
  ]
});

export const weaversProwess = defineTrait({
  triggers: [
    onTriggerPoint(weaverAttunementCompleted, {
      run: (runtime: ElementalistRuntime, { event }: WeaverTransition) => applyWeaversProwess(runtime, event)
    })
  ],
  id: TRAIT.WEAVERS_PROWESS,
  name: "Weaver's Prowess",
  balance: {
    effects: [{ type: 'boon', name: 'Resistance', boon: 'resistance', stacks: 1, duration: 3 }]
  }
});

export const swiftRevenge = defineTrait({
  triggers: [onTriggerPoint(weaverCastCompleted, { run: applySwiftRevenge })],
  id: TRAIT.SWIFT_REVENGE,
  name: 'Swift Revenge',
  balance: {
    resourceGain: 25,
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 3, duration: 5 },
      { type: 'boon', name: 'Air', boon: 'swiftness', stacks: 1, duration: 5 }
    ]
  }
});

export const bolsteredElements = defineTrait({
  triggers: [onTriggerPoint(weaverCastCompleted, { run: applyBolsteredElements })],
  id: TRAIT.BOLSTERED_ELEMENTS,
  name: 'Bolstered Elements',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const elementsOfRage = defineTrait({
  triggers: [
    onTriggerPoint(weaverHandsInitialized, {
      run: (runtime: ElementalistRuntime) => initializeElementsOfRage(runtime)
    }),
    onTriggerPoint(weaverHandsChanged, {
      run: (runtime: ElementalistRuntime, { event }: WeaverTransition) => applyElementsOfRageAttunement(runtime, event)
    }),
    onTriggerPoint(weaverUnraveled, {
      run: (runtime: ElementalistRuntime, { cast, previousPrimary, previousSecondary }: WeaverUnraveled) =>
        applyUnravelElementsOfRage(runtime, cast, previousPrimary, previousSecondary)
    })
  ],
  id: TRAIT.ELEMENTS_OF_RAGE,
  name: 'Elements of Rage',
  balance: {
    durationMultiplier: 8
  },
  modifierRules: [
    {
      id: 'elementalist.elements-of-rage-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) => activeBuffStacks(context, 'elements of rage', 1) > 0
    },
    {
      id: 'elementalist.elements-of-rage-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => activeBuffStacks(context, 'elements of rage', 1) > 0
    }
  ],
  hooks: { availability: elementsOfRageAvailability }
});

export const flowState = defineTrait({
  id: TRAIT.FLOW_STATE,
  name: 'Flow State',
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

/** Seed the opener only after the mechanic has assigned both starting hands. */
function initializeElementsOfRage(context: ElementalistRuntime, emissionCast?: EffectDelivery['cast']): void {
  const core = professionCoreState(context),
    state = weaverState.from(context);
  if (core.primaryAttunement === state.secondaryAttunement) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTS_OF_RAGE);
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, 'Starting Attunement', 'starting-attunement'),
          at: context.time,
          source: 'Starting Attunement',
          sourceId: 'starting-attunement',
          actorType: 'player',
          kind: 'elements of rage',
          stacks: 1,
          duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
          skillName: 'Starting Attunement'
        },
        emissionCast
      )
    );
  }
}

/** Fully attuned setup swaps may carry Rage into combat before Weave Self observes the transition. */
function applyElementsOfRageAttunement(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const at = event.at,
    target = event.to,
    previous = event.from,
    sourceId = event.skillId ?? event.sourceId,
    source = event.skillName || event.source || 'Attunement',
    unravelActive = weaverState.from(context).unravelUntil > at;
  if (target === previous || unravelActive) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTS_OF_RAGE);
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, source, sourceId),
          at,
          source,
          sourceId,
          actorType: 'player',
          kind: 'elements of rage',
          stacks: 1,
          duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
          skillName: source
        },
        emissionCast
      )
    );
  }
}

/** Resistance follows the in-combat transition and precedes Core's Bountiful Power accounting. */
function applyWeaversProwess(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const at = event.at,
    target = event.to,
    previous = event.from,
    sourceId = event.skillId ?? event.sourceId,
    unravelActive = weaverState.from(context).unravelUntil > at;
  if (unravelActive || target === previous) {
    const weaversProwessProfile = requireBalanceProfileFromContext(context, TRAIT.WEAVERS_PROWESS);
    const resistance = requireEffect(weaversProwessProfile, 'boon', 'Resistance');
    if (resistance) {
      emitTraitProfile(context, TRAIT.WEAVERS_PROWESS, TRAIT.WEAVERS_PROWESS, undefined, {
        at: at,
        fullEnd: at,
        effect: { type: 'boon', name: 'Resistance' },
        cast: emissionCast,
        attribution: {
          source: "Weaver's Prowess",
          sourceId: sourceId,
          actorType: 'player',
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
      effect: { type: 'boon', name: 'Protection' },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      priority: 0,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BOLSTERED_ELEMENTS,
        actorType: 'player',
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
            actorType: 'player',
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
            actorType: 'player',
            name: skill.name,
            priority: 0
          }
        });
      } else if (element === 'Earth') {
        const swiftRevengeProfile = requireBalanceProfileFromContext(context, TRAIT.SWIFT_REVENGE);
        context.endurance.grant(balanceProfileNumber(swiftRevengeProfile, 'resourceGain'));
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
      effect: { type: 'condition', name: 'Weakness' },
      skillId: skill.id,
      skillName: skill.name,
      cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
      attribution: { source: skill.name, sourceId: skill.id, actorType: 'player', triggeredBy: '' },
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
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTS_OF_RAGE);
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at: cast.effectiveEnd,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          name: skill.name,
          kind: 'elements of rage',
          duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
          stacks: 1
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }
}
