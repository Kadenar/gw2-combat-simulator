import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { galeshotBuffPolicies } from '#gw2/professions/ranger/specializations/galeshot/effect-state.js';
import {
  galeshotCastAvailability,
  reactToGaleshotMissile
} from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import {
  activateMistral,
  scheduleWindForce,
  setCycloneBow
} from '#gw2/professions/ranger/specializations/galeshot/skills/index.js';
import {
  galeshotArrows,
  galeshotState,
  galeshotWindForce
} from '#gw2/professions/ranger/specializations/galeshot/state.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Arrow spending is immediate; Wind Force and completion traits become visible only at their own queue boundary. */
export const galeshotHooks: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  buffPolicies: galeshotBuffPolicies,
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    galeshotState.from(runtime).cycloneBowActive = Boolean(skill?.cycloneBowSkill);
  },

  resources: { arrows: galeshotArrows, windForce: galeshotWindForce },
  availability: galeshotCastAvailability,
  sideEffectHandlers: {
    'ranger.arrow-spend'(runtime, context) {
      runtime.resourceController.spend('arrows', Number(context.skill.arrowCost));
    },
    'ranger.hawkeye'(runtime) {
      runtime.resourceController.replace('windForce', 0);
    },
    'ranger.wind-force-start'(runtime, context) {
      if (context.kind === 'cast') scheduleWindForce(runtime, context.cast);
    },
    'ranger.mistral': activateMistral,
    'ranger.cyclone-bow-enter'(runtime, context) {
      setCycloneBow(runtime, context.skill, true);
    },
    'ranger.cyclone-bow-dismiss'(runtime, context) {
      setCycloneBow(runtime, context.skill, false);
    }
  },
  onCastCommit(runtime, cast) {
    const state = galeshotState.from(runtime);
    const skill = cast.skill;
    if (skill.cycloneBowSkill) runtime.fireTrigger(cycloneBowCompleted, { skill, at: runtime.time });
    if (skill.id === ID.PET_SWAP) state.wutheringWindReady = false;
    runtime.fireTrigger(galeshotCastCompleted, { skill, at: runtime.time });
  },
  tasks: {
    // Scheduled rewards survive bar dismissal; only their original cast gate decides whether to enqueue them.
    'ranger.wind-force'(runtime, gain) {
      runtime.resourceController.grant('windForce', Number(gain));
    }
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      reactToGaleshotMissile(runtime, event);
      runtime.fireTrigger(galeshotPetStrike, { event });
    },
    'control.resolved'(runtime, event) {
      runtime.fireTrigger(galeshotControlAccepted, { event });
    }
  }
};

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const galeshotPetStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.galeshot-pet-strike',
  [TRAIT.WUTHERING_WIND]
);

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const galeshotControlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'ranger.galeshot-control-accepted',
  [TRAIT.THRILL_OF_THE_CATCH]
);

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const galeshotCastCompleted = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.galeshot-cast-completed',
  [TRAIT.FLOCK_TOGETHER]
);

/** Hawkeye grants its damage window and Bluster primes its pet strike before Cloudburst party boons. */
export const cycloneBowCompleted = defineTriggerPoint<{ readonly skill: RangerSkill; readonly at: number }>(
  'ranger.cyclone-bow-completed',
  [TRAIT.GALE_FORCE, TRAIT.WUTHERING_WIND, TRAIT.CLOUDBURST]
);
