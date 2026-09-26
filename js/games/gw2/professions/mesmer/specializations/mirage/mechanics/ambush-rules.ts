import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { EPSILON, isTimeInWindow } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';

import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/traits/modifiers.js';

import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Applies Self-Deception to categorized Deception skills after their casts complete. */
export function completeMirageSkill(context: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
  const runtime = mesmerMechanicsFor(context);
  if (
    runtime.traits.has(TRAIT.SELF_DECEPTION) &&
    skill.categories?.includes('Deception') &&
    runtime.actions.currentResource() > 0
  ) {
    const selfDeceptionProfile = requireBalanceProfileFromContext(context, TRAIT.SELF_DECEPTION);
    runtime.resources.queueResources(
      context.time,
      balanceProfileNumber(selfDeceptionProfile, 'resourceGain'),
      runtime.activePrimaryWeapon(),
      `Self-Deception: ${skill.name}`,
      {
        traitId: TRAIT.SELF_DECEPTION,
        traitName: 'Self-Deception',
        sourceSkillId: skill.id
      }
    );
  }
}

export function mirageAvailability(context: MesmerRuntime, skill: MesmerSkill): AvailabilityResult {
  if (skill.id === ID.DODGE_MIRAGE_CLOAK) {
    const state = mirageState.from(context);
    const cost = Number(skill.resourceCost ?? 50);
    if (state.endurance >= cost - EPSILON) return { ready: true };
    return {
      ready: false,
      retryAt: context.endurance.readyAt(cost),
      code: 'mesmer.endurance',
      reason: `Dodge requires ${cost} endurance.`
    };
  }

  if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
    const mirrors = mirageState.from(context).mirrors;
    if (mirrors.some((mirror) => isTimeInWindow(context.time, mirror.availableAt, mirror.expiresAt))) {
      return { ready: true };
    }

    // A queued mirror-creation trigger is a valid retry boundary even though
    // the mirror does not enter specialization state until that task executes.
    const retryAt = Math.min(
      ...mirageState.from(context).pendingMirrorAts,
      ...mirrors.filter((mirror) => mirror.expiresAt > context.time).map((mirror) => mirror.availableAt)
    );
    return {
      ready: false,
      retryAt: Number.isFinite(retryAt) ? retryAt : null,
      code: 'mesmer.mirage-mirror',
      reason: 'No Mirage Mirror is available to pick up.'
    };
  }

  if (!skill.ambush) return { ready: true };
  const runtime = mesmerMechanicsFor(context);
  const activeAmbush = runtime.ambushAttacks[runtime.activePrimaryWeapon()];
  const state = mirageState.from(context);
  // An ambush selected during the preceding cast remains queued through its lockout. A later wait or cooldown
  // cannot extend that queue: the preceding cast must still occupy the lane at this action's start.
  const queuedAmbush = context.history
    .filter((event) => event.type === 'action')
    .some(
      (action) =>
        action.actorType === 'player' &&
        action.at < state.ambushUntil &&
        action.at < context.time - EPSILON &&
        Number(action.castLockoutEndsAt ?? action.endsAt) >= context.time - EPSILON
    );
  if (
    activeAmbush &&
    activeAmbush.name === skill.name &&
    state.ambushSource &&
    (state.ambushUntil > context.time || queuedAmbush)
  ) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.ambush',
    reason: `${skill.name} has no active Mirage Cloak ambush window.`
  };
}

const mirageModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.nomads-endurance',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      strikeBonus: 0.1,
      conditionBonus: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, target, parameters) => {
      // Illusion strikes do not inherit personal strike bonuses, while their conditions remain owner-resolved.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikeBonus : parameters.conditionBonus;
    },
    when: (context) =>
      hasTrait(context, TRAIT.NOMADS_ENDURANCE) && Boolean(context.timeline?.vigorActiveAt(context.time))
  },
  {
    id: 'mesmer.phantom-pain',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      duration: 10,
      maximumStacks: 4,
      strikePerStack: 0.0625,
      conditionPerStack: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, target, parameters) => {
      // Phantom Pain joins other additive outgoing-damage bonuses; phantasm
      // conditions use owner modifiers, but phantasm strikes use summon ownership.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return (
        timedStacks(context, 'phantom-pain', parameters.duration, parameters.maximumStacks) *
        (target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionPerStack : parameters.strikePerStack)
      );
    }
  }
]);

export const mirageAttributeRules = Object.freeze({
  modifierRules: mirageModifierRules
});

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const mirageEndurance: EndurancePolicy<MesmerRuntime> = {
  state: (context) => mirageState.from(context),
  maximum: () => 100,
  regenerationRate: (_context, vigor) => (vigor ? 7.5 : 5)
};
