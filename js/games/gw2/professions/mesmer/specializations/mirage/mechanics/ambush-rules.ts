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

import {
  initializeMirageRuntime,
  mirageControllerFor
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';

import type { SkillMechanicTrigger } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { MesmerCastContext, MesmerPrecastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import {
  advanceProfessionEndurance,
  professionEnduranceReadyAt,
  spendProfessionEndurance
} from '#gw2/platform/combat/resources/endurance-policy.js';

type MirageSkillMechanicHandler = (invocation: {
  readonly context: MesmerSchedulerContext;
  readonly skill: MesmerSkill;
  readonly trigger: SkillMechanicTrigger;
  readonly at: number;
  readonly castStart: number;
  readonly castEnd: number;
  readonly activationId: string;
}) => void;

export const mirageSkillMechanicHandlers: Readonly<Record<string, MirageSkillMechanicHandler>> = Object.freeze({
  'mesmer.mirage.create-mirror': ({ context, trigger, at, skill }) => {
    mirageControllerFor(mesmerRuntimeFor(context)).createMirrors(at, trigger.count ?? 1, skill.name);
  },
  'mesmer.mirage.grant-cloak': ({ context, at, skill }) => {
    mirageControllerFor(mesmerRuntimeFor(context)).grantMirageCloak(at, skill.name);
  },
  'mesmer.mirage.pick-up-mirror': ({ context, at, skill }) => {
    mirageControllerFor(mesmerRuntimeFor(context)).pickUpMirror(at, skill.name);
  },
  'mesmer.mirage.dodge': ({ context, at, skill }) => {
    spendProfessionEndurance(context, Number(skill.resourceCost ?? 50), at);
    const runtime = mesmerRuntimeFor(context);
    mirageControllerFor(runtime).grantMirageCloak(at, skill.name);
    if (runtime.traits.has(TRAIT.DECEPTIVE_EVASION)) {
      runtime.resources.queueResources(at, 1, runtime.activePrimaryWeapon(), 'Deceptive Evasion', {
        traitId: TRAIT.DECEPTIVE_EVASION,
        traitName: 'Deceptive Evasion'
      });
    }
  }
});

/** Applies Self-Deception to categorized Deception skills after their casts complete. */
function completeMirageSkill(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  if (
    runtime.traits.has(TRAIT.SELF_DECEPTION) &&
    skill.categories?.includes('Deception') &&
    runtime.actions.currentResource() > 0
  ) {
    const selfDeceptionProfile = requireBalanceProfileFromContext(context, TRAIT.SELF_DECEPTION);
    runtime.resources.queueResources(
      context.fullEnd,
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

function mirageAvailability(context: MesmerPrecastContext, skill: MesmerSkill): AvailabilityResult {
  if (skill.id === ID.DODGE_MIRAGE_CLOAK) {
    const state = mirageState.from(context);
    const cost = Number(skill.resourceCost ?? 50);
    if (state.endurance >= cost - EPSILON) return { ready: true };
    return {
      ready: false,
      retryAt: professionEnduranceReadyAt(context, cost, context.start),
      code: 'mesmer.endurance',
      reason: `Dodge requires ${cost} endurance.`
    };
  }

  if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
    const mirrors = mirageState.from(context).mirrors;
    if (mirrors.some((mirror) => isTimeInWindow(context.start, mirror.availableAt, mirror.expiresAt))) {
      return { ready: true };
    }

    // A queued mirror-creation trigger is a valid retry boundary even though
    // the mirror does not enter specialization state until that task executes.
    const retryAt = Math.min(
      context.tasks.nextAt('mesmer.mirage.create-mirror'),
      ...mirrors.filter((mirror) => mirror.expiresAt > context.start).map((mirror) => mirror.availableAt)
    );
    return {
      ready: false,
      retryAt: Number.isFinite(retryAt) ? retryAt : null,
      code: 'mesmer.mirage-mirror',
      reason: 'No Mirage Mirror is available to pick up.'
    };
  }

  if (!skill.ambush) return { ready: true };
  const runtime = mesmerRuntimeFor(context);
  const activeAmbush = runtime.ambushAttacks[runtime.activePrimaryWeapon()];
  const state = mirageState.from(context);
  // An ambush selected during the preceding cast remains queued through its lockout. A later wait or cooldown
  // cannot extend that queue: the preceding cast must still occupy the lane at this action's start.
  const queuedAmbush = context
    .eventsOfType('action')
    .some(
      (action) =>
        action.actorType === 'player' &&
        action.at < state.ambushUntil &&
        action.at < context.start - EPSILON &&
        Number(action.castLockoutEndsAt ?? action.endsAt) >= context.start - EPSILON
    );
  if (
    activeAmbush &&
    activeAmbush.name === skill.name &&
    state.ambushSource &&
    (state.ambushUntil > context.start || queuedAmbush)
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

export const mirageCastRules = Object.freeze({
  availability: {
    id: 'mesmer.mirage.availability',
    order: 20,
    handler: mirageAvailability
  }
});

/** Regenerates endurance between Vigor boundaries and expires mirrors when their pickup windows close. */
function advanceMirageScheduler(context: MesmerSchedulerContext, target: number): void {
  const state = mirageState.from(context);
  advanceProfessionEndurance(context, target);
  // Cleanup shares pickup's exclusive deadline so the final live microsecond remains usable.
  state.mirrors = state.mirrors.filter((mirror) => mirror.expiresAt > target);
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

export const mirageSchedulerHooks = Object.freeze({
  initialize: initializeMirageRuntime,
  advance: {
    id: 'mesmer.mirage.mirrors',
    order: 20,
    handler: advanceMirageScheduler
  },
  onCastComplete: completeMirageSkill
});

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const mirageEndurance: EndurancePolicy<MesmerSchedulerContext> = {
  state: (context) => mirageState.from(context),
  maximum: () => 100,
  regenerationRate: (_context, vigor) => (vigor ? 7.5 : 5)
};
