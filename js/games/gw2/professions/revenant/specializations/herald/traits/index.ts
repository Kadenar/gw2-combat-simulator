import { countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';

import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  HERALD_DRACONIC_ECHO_PROFILE_ID,
  HERALD_ELEVATED_COMPASSION_PROFILE_ID,
  HERALD_SHARED_EMPOWERMENT_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { draconicEchoActive } from '#gw2/professions/revenant/specializations/herald/traits/behavior.js';

/** Owns Core Value tuning and behavior at its established execution boundaries. */
export const coreValue = defineTrait({
  id: TRAIT.CORE_VALUE,
  name: 'Core Value',
  balance: { duration: 1 }
});

/** Owns Draconic Echo tuning and behavior at its established execution boundaries. */
export const draconicEcho = defineTrait({
  modifierRules: [
    {
      id: 'revenant.draconic-echo-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        balanceProfileNumber(requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID), 'damageBonus'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_STRENGTH)
    },
    {
      id: 'revenant.draconic-echo-elements',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        balanceProfileNumber(requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID), 'damageBonus'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_ELEMENTS)
    },
    {
      id: 'revenant.draconic-echo-darkness',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
          'criticalChanceBonus'
        ),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_DARKNESS)
    }
  ],
  id: TRAIT.DRACONIC_ECHO,
  name: 'Draconic Echo',
  balance: {
    id: HERALD_DRACONIC_ECHO_PROFILE_ID,
    duration: 6,
    damageBonus: 0.1,
    criticalChanceBonus: 0.1,
    boonDurationBonus: 10,
    effects: []
  }
});

/** Owns Elevated Compassion tuning and behavior at its established execution boundaries. */
export const elevatedCompassion = defineTrait({
  buildAttributes: traitAttributeEffects(HERALD_ELEVATED_COMPASSION_PROFILE_ID, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ]),
  id: TRAIT.ELEVATED_COMPASSION,
  name: 'Elevated Compassion',
  balance: {
    id: HERALD_ELEVATED_COMPASSION_PROFILE_ID,
    attributeConversion: 0.13,
    description: 'Grants quickness while aggregate upkeep is at least six.',
    cooldown: 1,
    threshold: 6,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 1.25,
        stacks: 1,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Forceful Persistence tuning and behavior at its established execution boundaries. */
export const forcefulPersistence = defineTrait({
  id: TRAIT.FORCEFUL_PERSISTENCE,
  name: 'Forceful Persistence',
  modifierRules: [
    {
      id: 'revenant.forceful-persistence',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      // Each active facet contributes 10%, other upkeeps 25%; share Ferocious Aggression's additive bucket.
      amount: (context) =>
        (revenantRuntimeCoreState(context).activeUpkeeps || []).reduce(
          (bonus, upkeep) => bonus + (HERALD_BASE_SKILL_MECHANICS[Number(upkeep.skillId)]?.facet ? 0.1 : 0.25),
          0
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Reinforced Potency tuning and behavior at its established execution boundaries. */
export const reinforcedPotency = defineTrait({
  buildAttributes: traitAttributeEffects(TRAIT.REINFORCED_POTENCY, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ]),
  id: TRAIT.REINFORCED_POTENCY,
  name: 'Reinforced Potency',
  balance: { attributeBonus: 240 },
  modifierRules: [
    {
      id: 'revenant.reinforced-potency',
      order: 103,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      // +1% per unique active boon; capped at 12 boon types so the theoretical maximum is +12%.
      amount: (context) => countActiveBoons(context) * 0.01,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Shared Empowerment tuning and behavior at its established execution boundaries. */
export const sharedEmpowerment = defineTrait({
  id: TRAIT.SHARED_EMPOWERMENT,
  name: 'Shared Empowerment',
  balance: {
    id: HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
    description: 'Applying a boon to an ally grants nearby allies one stack of might.',
    internalCooldown: 1,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        actorType: 'effect',
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      emit: HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
      on: 'buff.applied',
      icd: 'profile',
      when: (runtime, event) =>
        event.sourceId !== TRAIT.SHARED_EMPOWERMENT &&
        isStandardBoon(String(event.kind)) &&
        Number(event.resolvedAudience?.recipientCount) > 0 &&
        Boolean(
          requireEffect(
            requireBalanceProfileFromContext(runtime, HERALD_SHARED_EMPOWERMENT_PROFILE_ID),
            'boon',
            'might'
          )
        ),
      effects: (effect) => effect.type === 'boon' && effect.name === 'might',
      attribution: {
        source: 'revenant',
        skillId: TRAIT.SHARED_EMPOWERMENT,
        skillName: 'Shared Empowerment',
        name: 'Shared Empowerment — might'
      }
    }
  ]
});

export const traitDefinitions = [
  coreValue,
  draconicEcho,
  sharedEmpowerment,
  elevatedCompassion,
  reinforcedPotency,
  forcefulPersistence
];
