import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { completeTroubadourPhantasm } from '#gw2/professions/mesmer/specializations/troubadour/traits/harmonize.js';
import { troubadourEndurance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/endurance.js';
import { initializeTroubadourRuntime } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import {
  scheduleTroubadourPerformance,
  completeTroubadourPerformance,
  resolveCrescendo
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import {
  observeSyncopateEvent,
  triggerMethodOfMadnessSyncopate
} from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Instruments commit notes on completion; delayed waves and accepted disables retain their own timing. */
export const troubadourHooks: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize(runtime) {
    initializeTroubadourRuntime(runtime);
    // Keep the completed-heal consequence queued at the same boundary without observing log text.
    mesmerMechanicsFor(runtime).methodOfMadnessCommitted = (at) => runtime.schedule('mesmer.syncopate', at);
  },
  endurance: troubadourEndurance,
  onCastCommit: completeTroubadourPhantasm,
  sideEffectHandlers: {
    'mesmer.troubadour.performance-traits'(runtime, context) {
      if (context.kind === 'cast') scheduleTroubadourPerformance(runtime, context.cast, context.skill as MesmerSkill);
    },
    'mesmer.troubadour.commit-instrument'(runtime, context) {
      if (context.kind === 'cast') completeTroubadourPerformance(runtime, context.cast, context.skill as MesmerSkill);
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
      const required = (context.skill as MesmerSkill).tale?.instrument;
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
        skill: context.skill as MesmerSkill,
        at: runtime.time,
        eligible: Boolean(mesmerMechanicsFor(runtime).castDetails.get(context.cast.id)?.taleEligible)
      });
    }
  },
  tasks: {
    'mesmer.crescendo'(runtime, data) {
      const { cast } = data as { cast: RuntimeCast };
      withMesmerCastEmission(runtime, cast, cast.skill as MesmerSkill, () =>
        resolveCrescendo(runtime, cast, cast.skill as MesmerSkill, cast.fullEnd)
      );
    },
    'mesmer.syncopate': triggerMethodOfMadnessSyncopate,
    'mesmer.troubadour.dodge'(runtime, data) {
      const cast = (data as { cast: RuntimeCast }).cast;
      const mechanics = mesmerMechanicsFor(runtime);
      if (!hasTrait(runtime, TRAIT.MAYHEM)) return;
      const flute = runtime.helpers.skillsById.get(ID.FLUSTERING_FLUTE);
      if (!flute || !runtime.cooldowns.has(flute.id)) return;
      runtime.cooldownController.reduceSkillRecharge(
        flute,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MAYHEM), 'rechargeReduction'),
        runtime.time
      );
      mechanics.addTraitProc('Mayhem', runtime.time, cast.skill.name);
    }
  },
  eventHandlers: {
    // Executed commitments supply historical cast-start and isolated attribute queries in both output modes.
    'mesmer.instrument': (runtime, event) => {
      runtime.history.push(event);
    }
  },
  reactions: { 'control.resolved': observeSyncopateEvent }
};
