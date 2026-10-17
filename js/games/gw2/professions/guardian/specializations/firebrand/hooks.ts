import { BOON, boonKey } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import {
  firebrandBuffPolicies,
  firebrandEffectStates
} from '#gw2/professions/guardian/specializations/firebrand/effect-state.js';
import {
  firebrandBuffApplied,
  firebrandControlAccepted,
  firebrandStruck
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import {
  firebrandEffectLifecycle,
  startFirebrandAshes
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import {
  FIREBRAND_MANTRA_WAKE,
  firebrandMantraAvailability,
  firebrandMantraLifecycle,
  initializeFirebrandMantras
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/mantras.js';
import {
  emitAshes,
  firebrandTomeAvailability,
  firebrandTomeLifecycle,
  initializeFirebrandTomes,
  reactToAshesHit,
  reactToTomeJusticeHit
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Pages, tome sessions, and mantra charges mutate one live state; report events never restore a snapshot. */
export const firebrandHooks = composeRuntimeHooks<GuardianRuntimeState, GuardianSkill>([
  firebrandMantraLifecycle,
  firebrandTomeLifecycle,
  firebrandEffectLifecycle,
  {
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
      'guardian.start-ashes'(runtime, context) {
        if (context.kind === 'cast') startFirebrandAshes(runtime, context.cast);
      }
    },
    initialize(runtime) {
      initializeFirebrandMantras(runtime);
      initializeFirebrandTomes(runtime);
    },
    availability: (runtime, skill) =>
      firebrandTomeAvailability(runtime, skill) ?? firebrandMantraAvailability(runtime, skill),
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
        if (event.kind === boonKey(BOON.ALACRITY)) runtime.schedule(FIREBRAND_MANTRA_WAKE, runtime.time);

        runtime.fireTrigger(firebrandBuffApplied, { cause: event });
      },
      'control.resolved'(runtime, event) {
        runtime.fireTrigger(firebrandControlAccepted, { cause: event });
      },
      'condition.applied'(runtime, event) {
        if (event.condition === CONDITION.IMMOBILIZED || event.condition === CONDITION.SLOW)
          runtime.fireTrigger(firebrandControlAccepted, { cause: event });
      }
    }
  }
]);
