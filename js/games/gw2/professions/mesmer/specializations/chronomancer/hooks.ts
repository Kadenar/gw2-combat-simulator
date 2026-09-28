import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { dispatchShatterResolved } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { observeChronomancerEvent } from '#gw2/professions/mesmer/specializations/chronomancer/traits/danger-time.js';
import { chronomancerAvailability } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import {
  chronomancerControllerFor,
  initializeChronomancerRuntime
} from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/runtime.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/time-bomb.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';

/** Continuum restores its deliberate checkpoint once; accepted control owns Danger Time. */
export const chronomancerHooks: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  // Chronomancer strengthens permanent player Alacrity without changing summon recharge or base work.
  playerAlacrityRechargeRate: 1.5,
  initialize: initializeChronomancerRuntime,
  availability: chronomancerAvailability,
  onCastCommit: completeChronomancerTimeBomb,
  sideEffectHandlers: {
    // The checkpoint owns its atomic clone spend and publishes the same resolved-shatter notification once.
    'mesmer.chronomancer.begin-continuum'(runtime, context) {
      if (context.kind !== 'cast') return;
      const resolution = chronomancerControllerFor(mesmerMechanicsFor(runtime)).beginContinuumSplit(
        context.skill as MesmerSkill,
        runtime.time,
        { activationId: context.cast.id }
      );
      dispatchShatterResolved(runtime, resolution);
    }
  },
  tasks: {
    'mesmer.continuum-expire'(runtime, data) {
      if (chronomancerState.from(runtime).continuum?.expiresAt !== data) return;
      chronomancerControllerFor(mesmerMechanicsFor(runtime)).restoreContinuum(runtime.time, 'split expired');
    },
    'mesmer.chronomancer.restore-continuum'(runtime, _data: unknown) {
      chronomancerControllerFor(mesmerMechanicsFor(runtime)).restoreContinuum(runtime.time, 'manual shift');
    }
  },
  eventHandlers: { 'mesmer.phantasm-resummoned': OBSERVABLE_EVENT_HANDLER },
  reactions: { 'control.resolved': observeChronomancerEvent }
};
