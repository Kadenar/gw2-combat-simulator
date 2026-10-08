import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { playerHealthFraction, skillForEvent, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefBuild } from '#gw2/professions/thief/types.js';

/** Owns Assassin's Fury tuning and behavior at the existing execution boundaries. */
export const assassinsFury = defineTrait({
  id: TRAIT.ASSASSINS_FURY,
  name: "Assassin's Fury",
  balance: {
    internalCooldown: 2,
    effects: [{ type: 'boon', name: 'Might', boon: 'Might', stacks: 3, duration: 8 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      emit: TRAIT.ASSASSINS_FURY,
      icd: 'profile',
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === 'fury' &&
        Boolean(event.resolvedAudience?.includesSelf) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.ASSASSINS_FURY), 'boon', 'Might')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'Might',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.ASSASSINS_FURY,
        skillName: "Assassin's Fury",
        name: "Assassin's Fury - might",
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Own the Fury payload and ICD; the critical-boon handler retains the dispatcher's precise reaction boundary. */
export const unrelentingStrikes = defineTrait({
  id: TRAIT.UNRELENTING_STRIKES,
  name: 'Unrelenting Strikes',
  balance: {
    internalCooldown: 8,
    effects: [{ type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 4 }]
  }
});

/** Owns this trait's modifier eligibility. */
export const deadlyAim = defineTrait({
  id: TRAIT.DEADLY_AIM,
  name: 'Deadly Aim',
  modifierRules: [
    {
      order: 6,
      id: 'thief.deadly-aim',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon === 'Pistol'
    }
  ]
});

/** Owns Ferocious Strikes tuning and behavior at the existing execution boundaries. */
export const ferociousStrikes = defineTrait({
  id: TRAIT.FEROCIOUS_STRIKES,
  name: 'Ferocious Strikes',
  modifierRules: [
    {
      order: 3,
      id: 'thief.ferocious-strikes',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_STRIKES), 'criticalDamage'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetHealthFraction(context) > 0.5
    }
  ],
  balance: {
    criticalDamage: 1.1
  }
});

/** Owns Hidden Killer tuning and behavior at the existing execution boundaries. */
export const hiddenKiller = defineTrait({
  id: TRAIT.HIDDEN_KILLER,
  name: 'Hidden Killer',
  modifierRules: [
    {
      order: 14,
      id: 'thief.hidden-killer',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HIDDEN_KILLER), 'criticalChance'),
      when: (context) => {
        const state = thiefRuntimeState(context);
        return (
          isGw2PlayerModifierOwnedEvent(context.event) &&
          // The explicit expiry is armed by stealth, never by the initial Revealed sentinel.
          (state.stealthStartedAt || 0) <= context.time &&
          ((state.stealthUntil || 0) > context.time || (state.hiddenKillerUntil || 0) > context.time)
        );
      }
    }
  ],
  balance: {
    criticalChance: 1,
    duration: 4
  }
});

/** Owns Keen Observer tuning and behavior at the existing execution boundaries. */
export const keenObserver = defineTrait({
  id: TRAIT.KEEN_OBSERVER,
  name: 'Keen Observer',
  modifierRules: [
    {
      order: 13,
      id: 'thief.keen-observer',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      // Preserve low-health stat previews; simulation queries always return full player health.
      amount: (context) => {
        const keenObserverProfile = requireBalanceProfileFromContext(context, TRAIT.KEEN_OBSERVER);
        return playerHealthFraction(context) > 0.5
          ? balanceProfileNumber(keenObserverProfile, 'criticalChance')
          : balanceProfileNumber(keenObserverProfile, 'lowHealthCriticalChance');
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    lowHealthCriticalChance: 0.1,
    criticalChance: 0.15
  }
});

/** Owns No Quarter tuning and behavior at the existing execution boundaries. */
export const noQuarter = defineTrait({
  id: TRAIT.NO_QUARTER,
  name: 'No Quarter',
  balance: {
    internalCooldown: 2,
    attributeBonus: 250,
    effects: [{ type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 2 }]
  },
  buildAttributes(_common, { build, balanceContext }) {
    const thiefBuild = build as ThiefBuild;
    const noQuarterProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.NO_QUARTER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(noQuarterProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: Boolean(thiefBuild.assumptions?.fury)
        }
      ]
    };
  }
});

/** Owns Practiced Tolerance tuning and behavior at the existing execution boundaries. */
export const practicedTolerance = defineTrait({
  id: TRAIT.PRACTICED_TOLERANCE,
  name: 'Practiced Tolerance',
  balance: { attributeConversion: 0.1 },
  buildAttributes(_common, { balanceContext }) {
    const practicedToleranceProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.PRACTICED_TOLERANCE);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(practicedToleranceProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Owns Signets of Power tuning and behavior at the existing execution boundaries. */
export const signetsOfPower = defineTrait({
  id: TRAIT.SIGNETS_OF_POWER,
  name: 'Signets of Power',
  balance: {
    resourceGain: 3
  }
});

/** Owns Sundering Shade tuning and behavior at the existing execution boundaries. */
export const sunderingShade = defineTrait({
  id: TRAIT.SUNDERING_SHADE,
  name: 'Sundering Shade',
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5
      }
    ]
  }
});

/** Owns Twin Fangs tuning and behavior at the existing execution boundaries. */
export const twinFangs = defineTrait({
  id: TRAIT.TWIN_FANGS,
  name: 'Twin Fangs',
  modifierRules: [
    {
      order: 4,
      id: 'thief.twin-fangs-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      // Preserve low-health stat previews; simulation queries always return full player health.
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS),
          playerHealthFraction(context) > 0.5 ? 'criticalDamage' : 'lowHealthCriticalDamage'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: 5,
      id: 'thief.twin-fangs-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && Boolean(context.config?.target?.defiant)
    }
  ],
  balance: {
    criticalDamage: 1.07,
    lowHealthCriticalDamage: 1.05,
    criticalChance: 0.07
  }
});

/** Natural expiry and forced exit share the selected patch's linger duration. */
export function hiddenKillerLinger(runtime: ThiefRuntime): number {
  return balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HIDDEN_KILLER), 'duration');
}

// Signets of Power grants initiative at acceptance, even if the cast is later interrupted.
export const SIGNET_INITIATIVE: NonNullable<NonNullable<Skill['sideEffects']>> = [
  {
    on: 'castStart',
    when: (runtime) => hasTrait(runtime, TRAIT.SIGNETS_OF_POWER),
    do: {
      type: 'resourceGrant',
      resource: 'initiative',
      amount: { profile: TRAIT.SIGNETS_OF_POWER, field: 'resourceGain' }
    }
  }
];
