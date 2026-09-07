import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/state/boons.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import {
  advanceEndurance,
  enduranceReadyAt,
  grantEndurance,
  spendEndurance
} from '#gw2/platform/combat/resources/endurance.js';
import { EPSILON } from '#kernel/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/traits/modifiers.js';

import {
  initializeMirageRuntime,
  mirageControllerFor
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { AvailabilityResult, ScheduledTask } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { SkillMechanicTrigger } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { MesmerCastContext, MesmerPrecastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

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
    const state = mirageState.from(context);
    Object.assign(state, spendEndurance(state, Number(skill.resourceCost ?? 50), at, state.maximumEndurance));
    const runtime = mesmerRuntimeFor(context);
    mirageControllerFor(runtime).grantMirageCloak(at, skill.name);
    if (runtime.traits.has(TRAIT.DECEPTIVE_EVASION)) {
      runtime.resources.queueResources(at + EPSILON, 1, runtime.activePrimaryWeapon(), 'Deceptive Evasion', {
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
    runtime.resources.queueResources(
      context.fullEnd + EPSILON,
      balanceProfileValueFromContext(context, TRAIT.SELF_DECEPTION, 'resourceGain', 1),
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
      retryAt: enduranceReadyAt(
        state.endurance,
        cost,
        context.start,
        mirageEnduranceRate(context, context.start),
        EPSILON
      ),
      code: 'mesmer.endurance',
      reason: `Dodge requires ${cost} endurance.`
    };
  }

  if (skill.id === ID.PICK_UP_MIRAGE_MIRROR) {
    const mirrors = mirageState.from(context).mirrors;
    if (
      mirrors.some(
        (mirror) => mirror.availableAt <= context.start + EPSILON && mirror.expiresAt > context.start + EPSILON
      )
    ) {
      return { ready: true };
    }

    // A queued mirror-creation trigger is a valid retry boundary even though
    // the mirror does not enter specialization state until that task executes.
    const retryAt = Math.min(
      context.tasks.nextAt('mesmer.mirage.create-mirror'),
      ...mirrors.filter((mirror) => mirror.expiresAt > context.start + EPSILON).map((mirror) => mirror.availableAt)
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
        action.at < state.ambushUntil - EPSILON &&
        action.at < context.start - EPSILON &&
        Number(action.castLockoutEndsAt ?? action.endsAt) >= context.start - EPSILON
    );
  if (
    activeAmbush &&
    activeAmbush.name === skill.name &&
    state.ambushSource &&
    (state.ambushUntil > context.start + EPSILON || queuedAmbush)
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

/** Standard endurance regenerates at five per second, increased by half while Vigor is active. */
function mirageEnduranceRate(context: MesmerSchedulerContext, at: number): number {
  return context.config.boons?.vigor || context.hasBuff('vigor', at) ? 7.5 : 5;
}

/** Preserve earned endurance when Vigor starts or expires, including stacked duration. */
function scheduleMirageVigorExpiry(context: MesmerSchedulerContext, task: ScheduledTask): void {
  context.tasks.cancelOwner('mesmer.mirage.vigor-expiry');
  const remaining = remainingDurationStackSeconds(context.eventsOfType('buff'), task.at, {
    includes: (event) => event.kind === 'vigor' && buffMatchesAudience(event, 'all'),
    maximum: durationStackingBoonCapSeconds('vigor')
  });
  if (remaining > EPSILON) {
    context.tasks.schedule({
      type: 'mesmer.mirage.vigor-boundary',
      at: task.at + remaining,
      ownerId: 'mesmer.mirage.vigor-expiry'
    });
  }
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
  Object.assign(
    state,
    advanceEndurance(
      state,
      target,
      mirageEnduranceRate(context, (state.enduranceUpdatedAt + target) / 2),
      state.maximumEndurance
    )
  );
  state.mirrors = state.mirrors.filter((mirror) => mirror.expiresAt > target + EPSILON);
}

/** Updates Mirage dodge recovery for timed Vigor and Sigil of Energy's endurance grant. */
function observeMirageEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  // Schedule at the application time so future buffs cannot accelerate recovery early.
  if (
    event.type === 'buff' &&
    event.kind === 'vigor' &&
    !context.config.boons?.vigor &&
    buffMatchesAudience(event, 'all')
  ) {
    context.tasks.schedule({ type: 'mesmer.mirage.vigor-boundary', at: event.at });
  }

  if (event.type !== 'proc' || event.sourceId !== 'sigil.energy') return;
  const state = mirageState.from(context);
  Object.assign(state, grantEndurance(state, 50, event.at, state.maximumEndurance));
}

export const mirageModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
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
  taskHandlers: Object.freeze({
    'mesmer.mirage.vigor-boundary': scheduleMirageVigorExpiry
  }),
  advance: {
    id: 'mesmer.mirage.mirrors',
    order: 20,
    handler: advanceMirageScheduler
  },
  onCastComplete: completeMirageSkill,
  onEventScheduled: {
    id: 'mesmer.mirage.energy-sigil',
    order: 20,
    handler: observeMirageEvent
  }
});
