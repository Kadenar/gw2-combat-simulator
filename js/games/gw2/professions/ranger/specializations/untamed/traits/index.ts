import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { grantAmbush } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';

function untamedModifierState(context: Gw2ModifierContext): Partial<UntamedModifierState> {
  return readProfessionSpecializationState<UntamedModifierState>(context.runtime?.profession, 'Untamed') || {};
}

function rangerUnleashed(context: Gw2ModifierContext): boolean {
  return untamedModifierState(context).rangerUnleashed === true;
}

/** Owns Natural Fortitude's live tuning and trait behavior. */
export const naturalFortitude = defineTrait({
  id: TRAIT.NATURAL_FORTITUDE,
  name: 'Natural Fortitude',
  balance: {
    attributeBonus: 240
  },
  buildAttributes: traitAttributeEffects(TRAIT.NATURAL_FORTITUDE, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Let Loose's live tuning and trait behavior. */
export const letLoose = defineTrait({
  id: TRAIT.LET_LOOSE,
  name: 'Let Loose',
  balance: {
    internalCooldown: 9,
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 5, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 10, stacks: 5 }
    ]
  },
  hooks: {
    onCastCommit(runtime, cast) {
      const state = untamedState.from(runtime);
      if (
        cast.skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS &&
        runtime.combatActive &&
        hasTrait(runtime, TRAIT.LET_LOOSE) &&
        runtime.procs.claim(TRAIT.LET_LOOSE, 'ranger.untamed.letLoose', runtime.time)
      ) {
        // Let Loose claims its own interval, then rearms Unleashed Power independently.
        runtime.procs.readyAt['ranger.untamed.unleashedPower'] = 0;
        if (state.rangerUnleashed) grantAmbush(runtime);
      }
    }
  }
});

/** Owns Blinding Outburst's live tuning and trait behavior. */
export const blindingOutburst = defineTrait({
  id: TRAIT.BLINDING_OUTBURST,
  name: 'Blinding Outburst',
  balance: {
    effects: [{ name: 'Blindness', type: 'condition', condition: 'Blindness', duration: 2, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.blinding-outburst',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.25,
      when: (context) => BLINDING_OUTBURST_SKILL_IDS.has(Number(context.event?.skillId ?? context.skillId))
    }
  ],
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.skillId === ID.VENOMOUS_OUTBURST &&
        Number(event.coefficient) > 0 &&
        (isPlayerStrike(event) || isPetStrike(event)),
      emit: TRAIT.BLINDING_OUTBURST,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Blindness',
      attribution: (_runtime, event) => ({
        ownerActorType: 'player',
        skillId: TRAIT.BLINDING_OUTBURST,
        skillName: 'Blinding Outburst',
        name: 'Blinding Outburst - Blindness',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Ferocious Symbiosis's live tuning and trait behavior. */
export const ferociousSymbiosis = defineTrait({
  id: TRAIT.FEROCIOUS_SYMBIOSIS,
  name: 'Ferocious Symbiosis',
  balance: {
    maximumStacks: 5,
    durationMultiplier: 5,
    internalCooldown: 0.5
  },
  modifierRules: [
    {
      order: 102,
      id: 'ranger.ferocious-symbiosis',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        baseFactor: 1,
        maximumStacks: 5,
        damagePerStack: 0.05
      },
      factor: (context, _target, parameters) => {
        const state = untamedModifierState(context);
        const pet = context.event?.source === 'ranger-pet';
        // Pet strikes use Pet stacks; player strikes use Player stacks (each built by the other).
        const stacks = pet
          ? context.time < (state.ferociousSymbiosisPetUntil || 0)
            ? state.ferociousSymbiosisPetStacks || 0
            : 0
          : context.time < (state.ferociousSymbiosisPlayerUntil || 0)
            ? state.ferociousSymbiosisPlayerStacks || 0
            : 0;
        return parameters.baseFactor + Math.min(parameters.maximumStacks, stacks) * parameters.damagePerStack;
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) || context.event?.source === 'ranger-pet'
    }
  ]
});

/** Owns Debilitating Blows's live tuning and trait behavior. */
export const debilitatingBlows = defineTrait({
  id: TRAIT.DEBILITATING_BLOWS,
  name: 'Debilitating Blows',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: 'Poisoned', type: 'condition', condition: 'Poisoned', duration: 5, stacks: 2 },
      { name: 'Slow', type: 'condition', condition: 'Slow', duration: 2, stacks: 2 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.DEBILITATING_BLOWS,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        untamedState.from(runtime).rangerUnleashed &&
        Boolean(
          requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.DEBILITATING_BLOWS), 'condition', 'Poisoned')
        ),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Poisoned',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.DEBILITATING_BLOWS,
        skillName: 'Debilitating Blows',
        name: `Debilitating Blows - Poisoned`,
        ownerActorType: 'player',
        triggeredBy: event.skillName
      })
    },
    {
      emit: TRAIT.DEBILITATING_BLOWS,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        !untamedState.from(runtime).rangerUnleashed &&
        Boolean(
          requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.DEBILITATING_BLOWS), 'condition', 'Slow')
        ),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Slow',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.DEBILITATING_BLOWS,
        skillName: 'Debilitating Blows',
        name: `Debilitating Blows - Slow`,
        ownerActorType: 'player',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Enhancing Impact's live tuning and trait behavior. */
export const enhancingImpact = defineTrait({
  id: TRAIT.ENHANCING_IMPACT,
  name: 'Enhancing Impact',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 3, stacks: 1 },
      { name: 'stability', type: 'boon', boon: 'stability', duration: 3, stacks: 1 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.ENHANCING_IMPACT,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        untamedState.from(runtime).rangerUnleashed &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.ENHANCING_IMPACT), 'boon', 'quickness')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'quickness',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.ENHANCING_IMPACT,
        skillName: 'Enhancing Impact',
        name: `Enhancing Impact - quickness`,

        triggeredBy: event.skillName
      })
    },
    {
      emit: TRAIT.ENHANCING_IMPACT,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        !untamedState.from(runtime).rangerUnleashed &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.ENHANCING_IMPACT), 'boon', 'stability')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'stability',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.ENHANCING_IMPACT,
        skillName: 'Enhancing Impact',
        name: `Enhancing Impact - stability`,

        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Vow of the Untamed's live tuning and trait behavior. */
export const vowOfTheUntamed = defineTrait({
  id: TRAIT.VOW_OF_THE_UNTAMED,
  name: 'Vow of the Untamed',
  modifierRules: [
    {
      order: 100,
      id: 'ranger.vow-of-the-untamed',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.25,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        // Pet strikes don't benefit from Vow even when Ranger is unleashed.
        context.event?.source !== 'ranger-pet' &&
        rangerUnleashed(context)
    }
  ]
});

interface UntamedModifierState {
  readonly rangerUnleashed?: boolean;
  readonly ferociousSymbiosisPlayerStacks?: number;
  readonly ferociousSymbiosisPlayerUntil?: number;
  readonly ferociousSymbiosisPetStacks?: number;
  readonly ferociousSymbiosisPetUntil?: number;
}

const BLINDING_OUTBURST_SKILL_IDS = new Set<number>([ID.VENOMOUS_OUTBURST, ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
export const untamedTraits = [
  naturalFortitude,
  letLoose,
  blindingOutburst,
  ferociousSymbiosis,
  debilitatingBlows,
  enhancingImpact,
  vowOfTheUntamed
];
