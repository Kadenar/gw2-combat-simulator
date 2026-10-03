import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { troubadourEndurance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/endurance.js';
import {
  completeTroubadourPerformance,
  resolveCrescendo,
  scheduleTroubadourPerformance
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { initializeTroubadourRuntime } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { initializeSyncopate } from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Instruments commit notes on completion; delayed waves and accepted disables retain their own timing. */
export const troubadourHooks: Partial<RuntimeProfession<MesmerRuntimeState, MesmerSkill>> = {
  initialize(runtime) {
    initializeTroubadourRuntime(runtime);
    // Keep the completed-heal consequence queued at the same boundary without observing log text.
    initializeSyncopate(runtime);
  },
  endurance: troubadourEndurance,
  sideEffectHandlers: {
    'mesmer.troubadour.performance-traits'(runtime, context) {
      if (context.kind === 'cast') scheduleTroubadourPerformance(runtime, context.cast, context.skill);
    },
    'mesmer.troubadour.commit-instrument'(runtime, context) {
      if (context.kind === 'cast') completeTroubadourPerformance(runtime, context.cast, context.skill);
    },
    'mesmer.troubadour.schedule-crescendo'(runtime, context) {
      if (context.kind !== 'cast' || context.cast.cancelled) return;
      runtime.scheduleForCast(
        'mesmer.crescendo',
        context.cast.start + Number(context.skill.damageAtMs || 0) / 1000,
        context.cast
      );
    },
    // Capture the event-order-sensitive gate while the accepted action is still the latest history entry.
    'mesmer.troubadour.prepare-tale'(runtime, context) {
      if (context.kind !== 'cast') return;
      const required = context.skill.tale?.instrument;
      const action = runtime.history.find((event) => event.type === 'action' && event.activationId === context.cast.id);
      mesmerMechanicsFor(runtime).castDetails.get(context.cast.id)!.taleEligible = Boolean(
        required &&
        activeTroubadourInstrumentsAt(
          runtime.history.filter((event) => event.type === 'mesmer.instrument'),
          context.cast.start,
          action
        ).has(required)
      );
    },
    'mesmer.troubadour.resolve-tale'(runtime, context) {
      if (context.kind !== 'cast') return;
      resolveTroubadourTale({
        context: runtime,
        skill: context.skill,
        at: runtime.time,
        eligible: Boolean(mesmerMechanicsFor(runtime).castDetails.get(context.cast.id)?.taleEligible)
      });
    }
  },
  tasks: {
    'mesmer.crescendo'(runtime, data) {
      const { cast } = data as { cast: RuntimeCast<MesmerSkill> };
      resolveCrescendo(runtime, cast, cast.skill, cast.fullEnd, mesmerCastDelivery(cast, cast.skill));
    }
  },
  eventHandlers: {
    // Executed commitments supply historical cast-start and isolated attribute queries in both output modes.
    'mesmer.instrument': (runtime, event) => {
      runtime.history.push(event);
    }
  }
};
