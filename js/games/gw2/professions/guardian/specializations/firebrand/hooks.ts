import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import {
  firebrandBuffPolicies,
  firebrandEffectStates
} from '#gw2/professions/guardian/specializations/firebrand/effect-state.js';
import {
  firebrandBuffApplied,
  firebrandControlAccepted,
  firebrandStruck
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/activations.js';
import {
  firebrandEffectTasks,
  startFirebrandAshes
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import {
  FIREBRAND_MANTRA_WAKE,
  firebrandMantraActions,
  firebrandMantraAvailability,
  firebrandMantraWake,
  initializeFirebrandMantras,
  refreshFirebrandMantras
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/mantras.js';
import {
  emitAshes,
  firebrandTomeActions,
  firebrandTomeAvailability,
  firebrandTomePages,
  firebrandTomeTasks,
  initializeFirebrandTomes,
  reactToAshesHit,
  reactToTomeJusticeHit,
  refillFirebrandTomePages
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Pages, tome sessions, and mantra charges mutate one live state; report events never restore a snapshot. */
export const firebrandHooks: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  buffPolicies: firebrandBuffPolicies,
  observeEffects: firebrandEffectStates,
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'ashes',
      name: 'Ashes of the Just',
      source: 'Profession',
      unit: 'charge',
      sourceIds: ['guardian.ashes-of-the-just'],
      emit: (runtime) => emitAshes(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    if (skill?.tome) firebrandState.from(runtime).activeTome = skill.tome;
  },

  sideEffectHandlers: {
    ...firebrandMantraActions,
    ...firebrandTomeActions,
    'guardian.start-ashes'(runtime, context) {
      if (context.kind === 'cast') startFirebrandAshes(runtime, context.cast);
    }
  },
  resources: { tomePages: firebrandTomePages },
  initialize(runtime) {
    initializeFirebrandMantras(runtime);
    initializeFirebrandTomes(runtime);
  },
  availability: (runtime, skill) =>
    firebrandTomeAvailability(runtime, skill) ?? firebrandMantraAvailability(runtime, skill),
  /** Core resets virtue dormancy; full Renewed Focus completion refills pages without moving their recovery phase. */
  onCastCommit: refillFirebrandTomePages,
  onCooldownReset: refreshFirebrandMantras,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      if (event.actorType === 'player' && ((details as NativeResolvedDamageDetails).hitContext?.damage ?? 0) > 0) {
        reactToAshesHit(runtime, event, details);
        runtime.fireTrigger(firebrandStruck, { cause: event });
      }

      reactToTomeJusticeHit(runtime, event, details);
    },
    'buff.applied'(runtime, event) {
      // Executed history is appended after dispatch; reproject once the applied Alacrity window is queryable.
      if (event.kind === 'alacrity') runtime.schedule(FIREBRAND_MANTRA_WAKE, runtime.time);

      runtime.fireTrigger(firebrandBuffApplied, { cause: event });
    },
    'control.resolved'(runtime, event) {
      runtime.fireTrigger(firebrandControlAccepted, { cause: event });
    },
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized' || event.condition === 'Slow')
        runtime.fireTrigger(firebrandControlAccepted, { cause: event });
    }
  },
  tasks: { ...firebrandEffectTasks, ...firebrandTomeTasks, [FIREBRAND_MANTRA_WAKE]: firebrandMantraWake }
};
