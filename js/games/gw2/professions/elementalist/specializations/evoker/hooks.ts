import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import { registerElementalistAttunementTransition } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import { completeEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { availability } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { commitRechargeDuration } from '#gw2/professions/elementalist/specializations/evoker/mechanics/recharge.js';
import {
  initialize,
  flushPendingWeaponChargeGains
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import {
  onCastStart,
  onCastCommit,
  modifyFamiliarEffects,
  releaseElementalProcession,
  beginFamiliarCast,
  captureIgniteTier,
  scheduleEvokerSkillCommit,
  evokerSkillCommitTasks,
  finishEvokerCast
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { onAcceptedEvent } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { FAMILIAR_ELEMENTS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { applyAltruisticAspect } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';

/** Familiar casts own pending packets; accepted impacts spend enchantments in chronological order. */
export const evokerHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
  initialize(runtime) {
    initialize(runtime);
    registerElementalistEliteEvents(runtime, onAcceptedEvent);
    registerElementalistAttunementTransition(runtime, (context, cast) => {
      completeEvokerAttunement(context, cast, cast.skill);
    });
  },
  availability,
  reserveRecharge: commitRechargeDuration,
  prepareEvent(runtime, event) {
    if (!FAMILIAR_ELEMENTS.has(event.skillId ?? event.sourceId) || event.type === 'action') return event;
    if (canonicalTime(event.at) > runtime.time && ['damage', 'condition', 'control', 'blind'].includes(event.type)) {
      runtime.emitProcedural(event, { owner: { id: String(event.activationId), generation: 0 } });
      return null;
    }

    return event;
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
      withElementalistCast(runtime, context.cast, () =>
        releaseElementalProcession(runtime, context.cast, context.skill)
      );
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
    withElementalistCast(runtime, cast, () => {
      onCastCommit(runtime, cast, cast.skill);
      // This tail follows the skill-declared intrinsic tasks, retaining reset -> deferred grants -> final trait order.
      runtime.scheduleForCast('elementalist.evoker.finish-commit', runtime.time, cast, {}, undefined, -101);
    });
  },

  tasks: {
    ...evokerSkillCommitTasks,
    'elementalist.evoker.finish-commit'(runtime, data) {
      const { cast } = data as SkillTaskData;
      withElementalistCast(runtime, cast, () => {
        finishEvokerCast(runtime, cast, cast.skill);
        applyAltruisticAspect(runtime, cast, cast.skill);
      });
      delete evokerState.from(runtime).cancelledFamiliarActivations[cast.id];
    }
  },
  reactions: { 'damage.resolved': onAcceptedEvent, 'condition.applied': onAcceptedEvent }
};
