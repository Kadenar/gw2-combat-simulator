import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { bestialRageControl } from '#gw2/professions/ranger/core/traits/beastmastery/index.js';
import { soulbeastBuffPolicies } from '#gw2/professions/ranger/specializations/soulbeast/effect-state.js';
import {
  beastmodeLifecycle,
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastDamage
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { activateSoulbeastStance } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Compose the Beastmode lifecycle with stance grants and ordered damage reactions. */
export const soulbeastHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  beastmodeLifecycle,
  {
    buffPolicies: soulbeastBuffPolicies,
    // Core retains ownership; normal module compilation validates and gates this elite-only trigger.
    traitTriggers: [bestialRageControl],
    sideEffectHandlers: {
      'ranger.vulture-stance'(runtime, context) {
        activateSoulbeastStance(runtime, context.skill, 'vulture-stance', runtime.time);
      },
      'ranger.one-wolf-pack'(runtime, context) {
        if (context.kind !== 'cast') return;

        // Earlier trap pulses cannot echo until the stance's activation packet actually resolves.
        const at = context.cast.start + Number(context.skill.interruptCommitMs) / 1000;
        activateSoulbeastStance(runtime, context.skill, 'one-wolf-pack', at);
      }
    },
    reactions: {
      'damage.resolved'(runtime, event) {
        reactToSoulbeastDamage(runtime, event);
        reactToRangerWinterBite(runtime, event);
      },
      'buff.applied': reactToSoulbeastBuff
    }
  }
]);
