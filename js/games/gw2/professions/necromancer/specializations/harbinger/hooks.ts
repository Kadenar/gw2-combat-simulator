import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  harbingerBuffPolicies,
  harbingerEffectStates
} from '#gw2/professions/necromancer/specializations/harbinger/effect-state.js';
import { harbingerBlightLifecycle } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { harbingerStrike } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
import { harbingerElixirLifecycle } from '#gw2/professions/necromancer/specializations/harbinger/skills/elixir-actions.js';
import { harbingerShroudLifecycle } from '#gw2/professions/necromancer/specializations/harbinger/skills/shroud-actions.js';
import type { NecromancerRuntimeState, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Compose Blight and skill action owners without changing launch, impact, or trigger order. */
export const harbingerHooks = composeRuntimeHooks<NecromancerRuntimeState, NecromancerSkill>([
  harbingerBlightLifecycle,
  harbingerElixirLifecycle,
  harbingerShroudLifecycle,
  {
    buffPolicies: harbingerBuffPolicies,
    // Devouring Cut recharges during its final 80 ms, including casts shortened by interruption.
    rechargeStart(_context, cast, at) {
      return cast.skill.id === ID.DEVOURING_CUT ? Math.max(cast.start, cast.effectiveEnd - 0.08) : at;
    },
    observeEffects: harbingerEffectStates,
    reactions: { 'damage.resolved': (runtime, event) => runtime.fireTrigger(harbingerStrike, { event }) }
  }
]);
