import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { thiefInitiativeCost } from '#gw2/professions/thief/core/mechanics/resources.js';
import { thiefMobilityUsed } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_SKILL_IDS as SKILL, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const MOBILITY_COMPLETE = 'thief.mobility-complete';

/** Combat entry arms Deft Initiation; contextual mobility refreshes it after completion. */
export const thiefMobilityLifecycle: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  buffPolicies: () => [{ kind: 'twin-fangs', maximumStacks: 1 }],
  onCombatStart(runtime) {
    if (hasTrait(runtime, TRAIT.DEFT_INITIATION)) runtime.profession.core.deftInitiationArmed = true;
  },
  onCastCommit(runtime, cast) {
    // Execution admits only committed casts here; ordinary flagged mobility already dispatches from Core.
    if (cast.skill.movementSkill || cast.skill.shadowstepSkill) return;

    // Capture the accepted cost before the deferred task resolves its skill from the live catalog, as Core does.
    if (cast.skill.id === SKILL.SHADOW_SWAP)
      deferThiefCompletion(runtime, MOBILITY_COMPLETE, cast, {
        initiativeCost: thiefInitiativeCost(cast.skill)
      });
  },
  tasks: {
    [MOBILITY_COMPLETE](runtime, data) {
      const { cast, initiativeCost } = data as { cast: RuntimeCast<ThiefSkill>; initiativeCost: number };

      runtime.fireTrigger(thiefMobilityUsed, { cast, initiativeCost, movementSkill: false });
    }
  }
};
