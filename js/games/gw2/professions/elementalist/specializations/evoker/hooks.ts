import type { SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { registerElementalistAttunementTransition } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { evokerBuffPolicies } from '#gw2/professions/elementalist/specializations/evoker/effect-state.js';
import { completeEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { availability } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { FAMILIAR_ELEMENTS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { electricEnchantmentDamageEffect } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  applyCalcifyProtection,
  onAcceptedEvent
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import {
  evokerSkillCommitTasks,
  finishEvokerCast,
  onCastCommit,
  onCastStart,
  releaseElementalProcession,
  scheduleEvokerSkillCommit
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import {
  empoweredChargePolicy,
  familiarChargePolicy,
  flushPendingWeaponChargeGains
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import {
  evokerCastSettled,
  evokerInitialized
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import {
  beginFamiliarCast,
  captureIgniteTier,
  modifyFamiliarEffects
} from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Familiar casts own pending packets; accepted impacts spend enchantments in chronological order. */
export const evokerHooks: RuntimeHooks<ElementalistRuntimeState, ElementalistSkill> = {
  buffPolicies: evokerBuffPolicies,
  resources: { familiarCharges: familiarChargePolicy, empoweredCharges: empoweredChargePolicy },
  damageEffects: [electricEnchantmentDamageEffect],

  initialize(runtime) {
    runtime.fireTrigger(evokerInitialized, { at: runtime.time });
    registerElementalistEliteEvents(runtime, onAcceptedEvent);
    registerElementalistAttunementTransition(runtime, (context, cast) => {
      completeEvokerAttunement(context, cast, cast.skill);
    });
  },
  availability,
  // Familiar packets keep cancellable cast ownership without recursively resubmitting during preparation.
  effectOwner(_runtime, event) {
    if (
      FAMILIAR_ELEMENTS.has(event.skillId ?? event.sourceId) &&
      ['damage', 'condition', 'control'].includes(event.type)
    )
      return { id: String(event.activationId), generation: 0 };
    return undefined;
  },
  sideEffectHandlers: {
    ...Object.fromEntries(Object.keys(evokerSkillCommitTasks).map((type) => [type, scheduleEvokerSkillCommit])),
    'elementalist.evoker.begin-familiar'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Familiar activation requires a cast trigger.');
      beginFamiliarCast(runtime, context.cast, context.skill);
    },
    'elementalist.evoker.capture-ignite-tier'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Ignite requires a cast trigger.');
      captureIgniteTier(runtime, context.cast);
    },
    // Replay payloads with Procession ownership without performing a familiar cast's resource or trait settlement.
    'elementalist.evoker.release-elemental-procession'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Elemental Procession requires a cast trigger.');
      releaseElementalProcession(runtime, context.cast, context.skill);
    }
  },
  modifyEffects: modifyFamiliarEffects,
  onCastStart(runtime, cast) {
    onCastStart(runtime, cast, cast.skill);
  },
  onCastCancel(runtime, cast) {
    // Cancelled familiar casts release deferred weapon grants without resetting familiar charges.
    const state = evokerState.from(runtime);
    state.pendingWeaponCompletions = state.pendingWeaponCompletions.filter((entry) => entry.activationId !== cast.id);
    if (state.activeFamiliarCast?.reservationId === cast.id) {
      flushPendingWeaponChargeGains(runtime, state);
      state.activeFamiliarCast = null;
    }
  },
  onCastCommit(runtime, cast) {
    {
      onCastCommit(runtime, cast, cast.skill);
      // This tail follows the skill-declared intrinsic tasks, retaining reset -> deferred grants -> final trait order.
      runtime.scheduleForCast('elementalist.evoker.finish-commit', runtime.time, cast, {}, undefined, -101);
    }
  },
  tasks: {
    ...evokerSkillCommitTasks,
    'elementalist.evoker.finish-commit'(runtime, data) {
      const { cast } = data as SkillTaskData<ElementalistSkill>;
      {
        finishEvokerCast(runtime, cast);
        runtime.fireTrigger(evokerCastSettled, { cast });
      }

      delete evokerState.from(runtime).cancelledFamiliarActivations[cast.id];
    }
  },
  reactions: {
    'damage.resolved': onAcceptedEvent,
    'condition.applied': onAcceptedEvent,
    'control.resolved': applyCalcifyProtection
  }
};
