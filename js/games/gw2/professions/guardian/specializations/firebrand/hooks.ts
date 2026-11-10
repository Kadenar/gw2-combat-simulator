import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import {
  firebrandBuffPolicies,
  firebrandEffectStates
} from '#gw2/professions/guardian/specializations/firebrand/effect-state.js';
import {
  emitAshesForInspection,
  firebrandAshesLifecycle,
  reactToAshesHit,
  startFirebrandAshes
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/ashes.js';
import {
  firebrandMantraAvailability,
  firebrandMantraLifecycle
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/mantras.js';
import {
  firebrandTomeAvailability,
  firebrandTomeLifecycle,
  initializeFirebrandTomes,
  reactToTomeJusticeHit
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { firebrandControlAccepted } from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Pages, tome sessions, and mantra charges mutate one live state; report events never restore a snapshot. */
export const firebrandHooks = composeRuntimeHooks<GuardianRuntimeState, GuardianSkill>([
  // Prepare mantras before tomes and queue their Alacrity refresh before buff-triggered traits.
  firebrandMantraLifecycle,
  firebrandTomeLifecycle,
  firebrandAshesLifecycle,
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
        emit: (runtime) => emitAshesForInspection(runtime, damageInputEvent(runtime))
      }
    ],

    /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
    prepareDamageState(runtime, skill) {
      if (skill?.tome) firebrandState.from(runtime.profession).activeTome = skill.tome;
    },

    sideEffectHandlers: {
      'guardian.start-ashes'(runtime, context) {
        if (context.kind === 'cast') startFirebrandAshes(runtime, context.cast);
      }
    },
    initialize(runtime) {
      initializeFirebrandTomes(runtime);
    },
    // Tome decisions take precedence over mantra readiness.
    availability: (runtime, skill) =>
      firebrandTomeAvailability(runtime, skill) ?? firebrandMantraAvailability(runtime, skill),
    reactions: {
      'damage.resolved'(runtime, event, details) {
        if (event.actorType === ACTOR.PLAYER && details.hitContext.damage > 0) {
          reactToAshesHit(runtime, event);
        }

        reactToTomeJusticeHit(runtime, event);
      },
      'control.resolved'(runtime, event) {
        runtime.fireTrigger(firebrandControlAccepted, { cause: event });
      },
      'condition.applied'(runtime, event) {
        if (event.condition === CONDITION.IMMOBILIZED) runtime.fireTrigger(firebrandControlAccepted, { cause: event });
      }
    }
  }
]);
