import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { thiefCoreHooks } from '#gw2/professions/thief/core/hooks.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { thiefMobilityUsed } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_CORE_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/thief/core/rework/ids.js';
import { reworkCoreState } from '#gw2/professions/thief/core/rework/state.js';
import { THIEF_SKILL_IDS as SKILL } from '#gw2/professions/thief/data/ids.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const MOBILITY_COMPLETE = 'thief.rework-mobility-complete';

/** Preview-only lifecycle owns its buff and contextual mobility without rewriting elite or Live catalogs. */
const reworkHooks: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  buffPolicies: () => [{ kind: 'twin-fangs', maximumStacks: 1 }],
  onCombatStart(runtime) {
    if (hasTrait(runtime, REWORK.DEFT_INITIATION)) reworkCoreState(runtime).deftInitiationArmed = true;
  },
  onCastCommit(runtime, cast) {
    // Ordinary flagged skills dispatch from Core; only contextual/unflagged elite mobility needs this task.
    if (cast.cancelled || cast.skill.movementSkill || cast.skill.shadowstepSkill) return;

    const specialization = runtime.profession.specialization;
    const movingDodge =
      cast.skill.id === SHARED_SKILL_IDS.DODGE &&
      specialization.kind === 'Daredevil' &&
      ['Bounding Dodger', 'Lotus Training'].includes(specialization.state.selectedDodge);

    if (cast.skill.id === SKILL.SHADOW_SWAP || movingDodge) deferThiefCompletion(runtime, MOBILITY_COMPLETE, cast);
  },
  tasks: {
    [MOBILITY_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<ThiefSkill> };

      if (!cast.cancelled)
        runtime.fireTrigger(thiefMobilityUsed, { cast, initiativeCost: cast.skill.initiativeCost ?? 0 });
    }
  }
};

export const thiefCoreReworkHooks = composeRuntimeHooks([thiefCoreHooks, reworkHooks]);
