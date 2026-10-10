import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import type { StealAcceptance, StealthTransition } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import {
  stealAccepted,
  stealthEntered,
  stealthExited,
  thiefConditionApplied,
  venomsConsumed,
  type ThiefConditionApplication,
  type VenomConsumption
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

/** Owns Cloaked in Shadow tuning and behavior at the existing execution boundaries. */
export const cloakedInShadow = defineTrait({
  id: TRAIT.CLOAKED_IN_SHADOW,
  name: 'Cloaked in Shadow',
  balance: {
    effects: [
      // Entry Blind and the on-Blind siphon are separate authored components.
      { type: 'condition', name: 'Blindness', condition: 'Blindness', stacks: 1, duration: 5 },
      {
        type: 'strike',
        name: 'Cloaked in Shadow',
        // Keep the siphon's flat Power formula and breakdown separate from the triggering skill.
        coefficient: 0,
        flatStrikeBase: 130,
        flatStrikePowerCoeff: 0.04,
        damageBreakdownName: 'Life Siphon - Cloaked in Shadow',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    onTriggerPoint(stealthEntered, { run: enterCloakedInShadow }),
    {
      emit: TRAIT.CLOAKED_IN_SHADOW,
      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Blindness',
      effects: (effect) => effect.type === 'strike' && effect.name === 'Cloaked in Shadow',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.CLOAKED_IN_SHADOW,
        skillName: 'Cloaked in Shadow',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Hidden Thief tuning and behavior at the existing execution boundaries. */
export const hiddenThief = defineTrait({
  id: TRAIT.HIDDEN_THIEF,
  name: 'Hidden Thief',
  triggers: [onTriggerPoint(stealAccepted, { run: applyHiddenThief })],
  balance: {
    internalCooldown: 2,
    effects: [
      { type: 'condition', name: 'Blindness', condition: 'Blindness', stacks: 1, duration: 3 },
      { type: 'condition', name: 'Weakness', condition: 'Weakness', stacks: 1, duration: 3 }
    ]
  }
});

/** Owns Leeching Venoms tuning and behavior at the existing execution boundaries. */
export const leechingVenoms = defineTrait({
  id: TRAIT.LEECHING_VENOMS,
  name: 'Leeching Venoms',
  triggers: [
    // Spider charges follow both stealth transitions; siphons follow consumed venoms and allied venom procs.
    onTriggerPoint(stealthEntered, { run: grantLeechingVenomCharges }),
    onTriggerPoint(stealthExited, { run: grantLeechingVenomCharges }),
    onTriggerPoint(venomsConsumed, {
      when: (_runtime, { consumed }: VenomConsumption) => consumed > 0,
      run: applyLeechingVenoms
    }),
    onTriggerPoint(thiefConditionApplied, {
      when: (_runtime, { cause }: ThiefConditionApplication) => alliedVenomProc(cause),
      run: applyLeechingVenoms
    })
  ],
  balance: {
    maximumStacks: 6,
    resourceGain: 3,
    durationMultiplier: 24,
    // Leeching Venoms owns a flat life-steal formula, independent of weapon damage.
    effects: [
      {
        type: 'strike',
        name: 'Leeching Venoms',
        flatStrikeBase: 320,
        flatStrikePowerCoeff: 0.033,
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Owns Shadow Siphoning tuning and behavior at the existing execution boundaries. */
export const shadowSiphoning = defineTrait({
  id: TRAIT.SHADOW_SIPHONING,
  name: 'Shadow Siphoning',
  balance: {
    internalCooldown: 1,
    effects: [
      {
        type: 'strike',
        name: 'Shadow Siphoning',
        // Keep the siphon's flat Power formula and breakdown separate from the stealth attack.
        coefficient: 0,
        flatStrikeBase: 412,
        flatStrikePowerCoeff: 0.1,
        damageBreakdownName: 'Life Siphon - Shadow Siphoning',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHADOW_SIPHONING,
      on: 'damage.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        Boolean(runtime.helpers.skillsById.get(event.skillId!)?.stealthAttack) &&
        Boolean(
          requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.SHADOW_SIPHONING), 'strike', 'Shadow Siphoning')
        ),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Shadow Siphoning',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.SHADOW_SIPHONING,
        skillName: 'Shadow Siphoning',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Shadow's Rejuvenation tuning and behavior at the existing execution boundaries. */
export const shadowsRejuvenation = defineTrait({
  id: TRAIT.SHADOWS_REJUVENATION,
  name: "Shadow's Rejuvenation",
  triggers: [
    onTriggerPoint(stealthEntered, { run: enterShadowsRejuvenation }),
    onTriggerPoint(stealthExited, { run: exitShadowsRejuvenation })
  ],
  balance: { resourceGain: 1 }
});

/** Applies Cloaked in Shadow at its established mechanical boundary. */
function enterCloakedInShadow(runtime: ThiefRuntime, { skill, at }: StealthTransition): void {
  // Stealth entry supplies skill identity; the profile owns the independently removable blind.
  emitTraitProfile(runtime, TRAIT.CLOAKED_IN_SHADOW, TRAIT.CLOAKED_IN_SHADOW, undefined, {
    at,
    effect: { type: 'condition', name: 'Blindness' },
    attribution: {
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Cloaked in Shadow — Blindness'
    }
  });
}

/** Applies Shadow's Rejuvenation at its established mechanical boundary. */
function enterShadowsRejuvenation(runtime: ThiefRuntime): void {
  runtime.resourceController.grant('initiative', 2);
}

/** Applies Shadow's Rejuvenation at its established mechanical boundary. */
function exitShadowsRejuvenation(runtime: ThiefRuntime): void {
  const initiativeGain = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.SHADOWS_REJUVENATION),
    'resourceGain'
  );
  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

/** Hidden Thief claims its cooldown before either condition so a removed packet cannot re-arm it. */
function applyHiddenThief(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.HIDDEN_THIEF);
  // Admission is independent of either removable condition.
  if (!runtime.procs.claimCooldown(TRAIT.HIDDEN_THIEF, runtime.time, balanceProfileNumber(profile, 'internalCooldown')))
    return;
  emitTraitProfile(runtime, TRAIT.HIDDEN_THIEF, TRAIT.HIDDEN_THIEF, undefined, {
    at: runtime.time,
    activationId: cast.id,
    effects: (effect) => effect.type === 'condition',
    attribution: { actorType: 'player', skillId: cast.skill.id, skillName: cast.skill.name },
    transform: (packet) => ({ ...packet, name: 'Hidden Thief - ' + packet.condition })
  });
}

const VENOM_SKILL_IDS = new Set<number>([ID.SPIDER_VENOM, ID.SKALE_VENOM, ID.DEVOURER_VENOM]);

/** Each strike that consumed venom, and each allied venom proc, siphons once. */
function applyLeechingVenoms(
  context: ThiefResolverContext,
  { cause: event }: { readonly cause: ThiefResolverEvent }
): void {
  // Both consumed and allied venoms invoke the same authored life-steal formula.
  emitTraitProfile(context, TRAIT.LEECHING_VENOMS, TRAIT.LEECHING_VENOMS, undefined, {
    at: event.at,
    effect: { type: 'strike', name: 'Leeching Venoms' },
    attribution: { skillId: TRAIT.LEECHING_VENOMS, skillName: 'Leeching Venoms', triggeredBy: event.skillName }
  });
}

/** Only the first effect of an allied venom proc counts as its own siphon opportunity. */
function alliedVenomProc(application: ThiefResolverEvent): boolean {
  return Boolean(
    application.metadata?.triggeredByAlly &&
    VENOM_SKILL_IDS.has(Number(application.skillId)) &&
    (application.metadata.venomProcEffectIndex || 0) === 0
  );
}

/** Applies Leeching Venoms at its established mechanical boundary. */
function grantLeechingVenomCharges(runtime: ThiefRuntime, { at }: StealthTransition): void {
  const leeching = requireBalanceProfileFromContext(runtime, TRAIT.LEECHING_VENOMS);
  addVenomCharges(
    runtime.profession.core,
    ID.SPIDER_VENOM,
    at,
    balanceProfileNumber(leeching, 'resourceGain'),
    balanceProfileNumber(leeching, 'durationMultiplier'),
    balanceProfileNumber(leeching, 'maximumStacks')
  );
}
