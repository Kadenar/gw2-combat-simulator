import { galeshotBuffPolicies } from '#gw2/professions/ranger/specializations/galeshot/effect-state.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
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
  galeshotWindForce,
  galeshotState
} from '#gw2/professions/ranger/specializations/galeshot/state.js';
import {
  applyGaleshotCycloneBowTraits,
  completeGaleshotSkill,
  reactToGaleshotControl,
  reactToGaleshotPet
} from '#gw2/professions/ranger/specializations/galeshot/traits/behavior.js';
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
    if (skill.cycloneBowSkill) applyGaleshotCycloneBowTraits(runtime, skill);
    if (skill.id === ID.PET_SWAP) state.wutheringWindReady = false;
    completeGaleshotSkill(runtime, skill);
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
      reactToGaleshotPet(runtime, event);
    },
    'control.resolved': reactToGaleshotControl
  }
};
