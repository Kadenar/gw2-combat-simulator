import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import { registerElementalistAttunementTransition } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/live-events.js';
import { completeEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { availability } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { commitRechargeDuration } from '#gw2/professions/elementalist/specializations/evoker/mechanics/recharge.js';
import {
  initialize,
  flushPendingWeaponChargeGains
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import {
  onCastStart,
  onCastComplete,
  modifyFamiliarEffects,
  startMeditationEffects
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { onAcceptedEvent } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { FAMILIAR_ELEMENTS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { applyAltruisticAspect } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';

/** Familiar casts own pending packets; accepted impacts spend enchantments in chronological order. */
export const evokerLive: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
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
      runtime.schedule('elementalist.packet', event.at, event, { id: String(event.activationId), generation: 0 });
      return null;
    }

    return event;
  },
  modifyEffects: modifyFamiliarEffects,
  onCastStart(runtime, cast) {
    onCastStart(runtime, cast, cast.skill);
    if (!cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd))
      withElementalistCast(runtime, cast, () => startMeditationEffects(runtime, cast, cast.skill));
  },
  onCastComplete(runtime, cast) {
    const state = evokerState.from(runtime);
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) {
      state.pendingWeaponCompletions = state.pendingWeaponCompletions.filter((entry) => entry.activationId !== cast.id);
      if (state.activeFamiliarCast?.reservationId === cast.id) {
        // Interrupting the familiar releases completed weapon grants without applying its charge reset.
        flushPendingWeaponChargeGains(runtime, cast, state);
        state.activeFamiliarCast = null;
      }

      return;
    }

    withElementalistCast(runtime, cast, () => {
      onCastComplete(runtime, cast, cast.skill);
      // Meditation traits commit once with the completed cast, after interruption eligibility has been checked.
      applyAltruisticAspect(runtime, cast, cast.skill);
    });
    delete state.cancelledFamiliarActivations[cast.id];
  },

  reactions: { 'damage.resolved': onAcceptedEvent, 'condition.applied': onAcceptedEvent }
};
