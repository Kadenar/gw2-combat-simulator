import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  willbenderBuffPolicies,
  willbenderEffectStates
} from '#gw2/professions/guardian/specializations/willbender/effect-state.js';
import {
  completeWillbenderVirtue,
  prepareWillbenderVirtue,
  reactToWillbenderHit,
  willbenderVirtueActions,
  willbenderVirtueTasks
} from '#gw2/professions/guardian/specializations/willbender/mechanics/virtues.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Register the virtue state machine while ordinary physical-skill availability stays at the module boundary. */
export const willbenderHooks: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  buffPolicies: willbenderBuffPolicies,
  observeEffects: willbenderEffectStates,
  sideEffectHandlers: willbenderVirtueActions,
  availability(runtime, skill) {
    return skill.id === ID.REPOSE && !skillFlipReady(runtime.profession.core.availableFlips[ID.REPOSE], runtime.time)
      ? denySkillCast(skill, 'guardian.flip-not-armed', 'not currently armed.')
      : { ready: true };
  },
  onCastStart: prepareWillbenderVirtue,
  onCastCommit: completeWillbenderVirtue,
  tasks: willbenderVirtueTasks,
  reactions: { 'damage.resolved': reactToWillbenderHit }
};
