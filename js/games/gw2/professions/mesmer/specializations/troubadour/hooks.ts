import { troubadourBuffPolicies } from '#gw2/professions/mesmer/specializations/troubadour/effect-state.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { troubadourEndurance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/endurance.js';
import {
  completeTroubadourPerformance,
  resolveCrescendo,
  scheduleTroubadourPerformance
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Instruments commit notes on completion; delayed waves and accepted disables retain their own timing. */
export const troubadourHooks: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  buffPolicies: troubadourBuffPolicies,
  // Seed the selected pool before initialization; only earned gains trigger illusion rewards.
  resources: {
    notes: {
      kind: 'continuous',
      state: (context) => troubadourState.from(context).notes,
      maximum: (context) => mesmerResourceDefinition('Troubadour', context).maximum,
      initial: (context, maximum) => boundedNumber(context.config.initialResource ?? 0, 0, 0, maximum),
      recovery: () => 0
    }
  },
  initialize(runtime) {
    // Seed selected instrument ammo before accepting casts.
    for (const skill of runtime.helpers.skills) runtime.cooldownController.ensureAmmo(skill);
    // Keep the completed-heal consequence queued at the same boundary without observing log text.
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
      const action = runtime.facts
        .read()
        .find((event) => event.type === 'action' && event.activationId === context.cast.id);
      runtime.profession.core.castDetails.get(context.cast.id)!.taleEligible = Boolean(
        required &&
        activeTroubadourInstrumentsAt(
          runtime.facts.read().filter((event) => event.type === 'mesmer.instrument'),
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
        eligible: Boolean(runtime.profession.core.castDetails.get(context.cast.id)?.taleEligible)
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
      runtime.observations.record(event);
    }
  }
};
