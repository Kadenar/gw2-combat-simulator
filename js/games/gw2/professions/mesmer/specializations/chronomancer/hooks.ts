import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import {
  chronomancerAvailability,
  observeChronomancerEvent
} from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/chronomancer-rules.js';
import {
  chronomancerControllerFor,
  initializeChronomancerRuntime
} from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/runtime.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/time-bomb.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';

/** Continuum restores its deliberate checkpoint once; accepted control owns Danger Time. */
export const chronomancerHooks: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize: initializeChronomancerRuntime,
  availability: chronomancerAvailability,
  onCastComplete: completeChronomancerTimeBomb,
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
