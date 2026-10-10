import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import {
  activeRefreshedStacks,
  grantRefreshedStacks,
  type RefreshedStacks
} from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { TRAITS } from '#gw2/professions/ranger/data/traits-data.js';
import { UNTAMED_AMBUSH_SKILL_IDS } from '#gw2/professions/ranger/data/untamed-ambushes.js';
import { untamedStrike } from '#gw2/professions/ranger/specializations/untamed/hooks.js';
import { grantAmbush } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

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
    attributeBonus: 240,
    // The unconditional ambush siphon keeps trait attribution and reads the active patch's damage payload.
    effects: [
      {
        type: 'strike',
        name: 'Natural Fortitude',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 3517,
        flatStrikePowerCoeff: 0.005,
        canCrit: false,
        damageKind: 'life-steal',
        damageBreakdownName: 'Life Siphon - Natural Fortitude',
        icon: String(TRAITS.find((trait) => trait.id === TRAIT.NATURAL_FORTITUDE)?.icon || '')
      }
    ]
  },
  lifetime: {
    eventHandlers: {
      'ranger.natural-fortitude'(runtime, event) {
        emitTraitProfile(runtime, TRAIT.NATURAL_FORTITUDE, TRAIT.NATURAL_FORTITUDE, event, {
          at: event.at,
          effect: { type: 'strike', name: 'Natural Fortitude' },
          attribution: { actorType: 'player', source: event.source, offTarget: event.offTarget }
        });
      }
    }
  },
  buildAttributes: traitAttributeEffects(TRAIT.NATURAL_FORTITUDE, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Let Loose's live tuning and trait behavior. */
export const letLoose = defineTrait({
  triggers: [
    {
      on: 'castCommit',
      run(runtime, cast) {
        const state = untamedState.from(runtime);
        if (
          cast.skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS &&
          runtime.combatActive &&
          runtime.procs.claim(TRAIT.LET_LOOSE, 'ranger.untamed.letLoose', runtime.time)
        ) {
          // Let Loose claims its own interval, then rearms Unleashed Power independently.
          runtime.procs.setDeadline('ranger.untamed.unleashedPower', 0);
          if (state.rangerUnleashed) grantAmbush(runtime);
        }
      }
    },

    onTriggerPoint(untamedStrike, {
      when: (_runtime, input: TriggerPointInput<typeof untamedStrike>) => input.event.actorType === 'player',
      run: (runtime, input: TriggerPointInput<typeof untamedStrike>) => triggerLetLoose(runtime, input.event)
    })
  ],
  id: TRAIT.LET_LOOSE,
  name: 'Let Loose',
  balance: {
    internalCooldown: 9,
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 5, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 10, stacks: 5 }
    ]
  }
});

/** Owns Blinding Outburst's live tuning and trait behavior. */
export const blindingOutburst = defineTrait({
  id: TRAIT.BLINDING_OUTBURST,
  name: 'Blinding Outburst',
  balance: {
    damageIncrease: 0.25,
    effects: [{ name: 'Blindness', type: 'condition', condition: 'Blindness', duration: 2, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.blinding-outburst',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BLINDING_OUTBURST), 'damageIncrease'),
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
  triggers: [
    onTriggerPoint(untamedStrike, {
      run: (runtime, input: TriggerPointInput<typeof untamedStrike>) => triggerFerociousSymbiosis(runtime, input.event)
    })
  ],
  id: TRAIT.FEROCIOUS_SYMBIOSIS,
  name: 'Ferocious Symbiosis',
  balance: {
    damageMultiplier: 1,
    damageIncreasePerStack: 0.05,
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

      factor: (context) => {
        const state = untamedModifierState(context);
        const pet = context.event?.source === 'ranger-pet';
        // Pet strikes use Pet stacks; player strikes use Player stacks (each built by the other).
        const stacks = activeRefreshedStacks(
          pet ? state.ferociousSymbiosisPet : state.ferociousSymbiosisPlayer,
          context.time,
          'exclusive'
        );
        return (
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS),
            'damageMultiplier'
          ) +
          Math.min(
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS), 'maximumStacks'),
            stacks
          ) *
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS),
              'damageIncreasePerStack'
            )
        );
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
      cooldown: 'profile',
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
      cooldown: 'profile',
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
      cooldown: 'profile',
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
      cooldown: 'profile',
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
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.25 },
  modifierRules: [
    {
      order: 100,
      id: 'ranger.vow-of-the-untamed',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VOW_OF_THE_UNTAMED), 'damageIncrease'),
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
  readonly ferociousSymbiosisPlayer?: RefreshedStacks;
  readonly ferociousSymbiosisPet?: RefreshedStacks;
}

// The ambush damage bonus follows the same supported identities as availability and Let Loose.
const BLINDING_OUTBURST_SKILL_IDS = new Set<number>([ID.VENOMOUS_OUTBURST, ...UNTAMED_AMBUSH_SKILL_IDS]);

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

function triggerFerociousSymbiosis(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = untamedState.from(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  if (isPlayerStrike(event)) {
    if (!context.procs.claim(TRAIT.FEROCIOUS_SYMBIOSIS, 'ranger.untamed.ferociousSymbiosisPet', event.at)) return;
    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    state.ferociousSymbiosisPet = grantRefreshedStacks(
      state.ferociousSymbiosisPet,
      1,
      event.at,
      event.at + duration,
      maximumStacks,
      'exclusive'
    );
  } else if (isPetStrike(event)) {
    if (!context.procs.claim(TRAIT.FEROCIOUS_SYMBIOSIS, 'ranger.untamed.ferociousSymbiosisPlayer', event.at)) return;
    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayer = grantRefreshedStacks(
      state.ferociousSymbiosisPlayer,
      1,
      event.at,
      event.at + duration,
      maximumStacks,
      'exclusive'
    );
  }
}

function triggerLetLoose(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    // Every supported weapon ambush can grant Let Loose on its first landed strike.
    !AMBUSH_SKILL_IDS.has(Number(event.skillId)) ||
    // activationId is absent on synthetic events; guard prevents double-counting.
    !event.activationId
  ) {
    return;
  }

  // Each ambush activation grants boons exactly once even if the skill hits multiple times.
  if (!claimActivation(untamedState.from(context).untamedActivationClaims, 'ranger.let-loose', event.activationId))
    return;

  // Expand each surviving boon once per accepted ambush, preserving the party audience.
  emitTraitProfile(context, TRAIT.LET_LOOSE, TRAIT.LET_LOOSE, undefined, {
    at: event.at,
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.LET_LOOSE,
      actorType: 'effect',
      skillId: TRAIT.LET_LOOSE,
      skillName: 'Let Loose',
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      name: 'Let Loose - ' + packet.kind,
      audience: {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: context.profession.core.petActive ? [rangerPetCompanionId(context)] : []
      }
    }),
    preserveName: true,
    effects: (effect) => effect.type === 'boon'
  });
}

const AMBUSH_SKILL_IDS = new Set<number>(UNTAMED_AMBUSH_SKILL_IDS);
