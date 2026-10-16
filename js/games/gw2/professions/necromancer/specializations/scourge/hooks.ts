import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { shroudInvoked } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  scourgeBuffPolicies,
  scourgeEffectStates
} from '#gw2/professions/necromancer/specializations/scourge/effect-state.js';
import {
  scourgeConditionApplied,
  scourgeShadeCommitted
} from '#gw2/professions/necromancer/specializations/scourge/mechanics/trigger-points.js';
import { scourgeShadeLifecycle } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shades.js';
import { scourgeShroudLifecycle } from '#gw2/professions/necromancer/specializations/scourge/skills/shroud-actions.js';
import { scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Wire shade and shroud owners while preserving shroud invocation before shade commitment. */
export const scourgeHooks = composeRuntimeHooks<NecromancerRuntimeState, NecromancerSkill>([
  scourgeShadeLifecycle,
  scourgeShroudLifecycle,
  {
    /** Hold the selected preview state while evaluating detached damage queries. */
    prepareDamageState(runtime, _skill, inputs) {
      scourgeState.from(runtime).shades = Array(Number(inputs.shade ?? 0)).fill(Infinity);
    },
    buffPolicies: scourgeBuffPolicies,
    observeEffects: scourgeEffectStates,
    onCastCommit(runtime, cast) {
      if (cast.skill.id === ID.DESERT_SHROUD || cast.skill.id === ID.SANDSTORM_SHROUD)
        runtime.fireTrigger(shroudInvoked, { cast, at: runtime.time, activationId: cast.id });

      runtime.fireTrigger(scourgeShadeCommitted, { cast, at: runtime.time, activationId: cast.id });
    },
    reactions: {
      'condition.applied': (runtime, event) => runtime.fireTrigger(scourgeConditionApplied, { event })
    }
  }
]);
