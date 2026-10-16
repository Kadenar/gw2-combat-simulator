import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { bestialRageControl } from '#gw2/professions/ranger/core/traits/beastmastery/index.js';
import { soulbeastBuffPolicies } from '#gw2/professions/ranger/specializations/soulbeast/effect-state.js';
import {
  beastmodeLifecycle,
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastDamage
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { activateSoulbeastStance } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Compose the Beastmode lifecycle with stance grants and ordered damage reactions. */
export const soulbeastHooks: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  ...beastmodeLifecycle,
  buffPolicies: soulbeastBuffPolicies,
  sideEffectHandlers: {
    ...beastmodeLifecycle.sideEffectHandlers,
    'ranger.vulture-stance'(runtime, context) {
      activateSoulbeastStance(runtime, context.skill, 'vulture-stance', PROFILE.vultureStance);
    },
    'ranger.one-wolf-pack'(runtime, context) {
      soulbeastState.from(runtime).oneWolfPackUntil =
        runtime.time + activateSoulbeastStance(runtime, context.skill, 'one-wolf-pack', PROFILE.oneWolfPack);
    }
  },
  reactions: {
    // Core retains trait ownership; this elite registers its merged-pet control reaction.
    'control.resolved': bestialRageControl,
    'damage.resolved'(runtime, event) {
      reactToSoulbeastDamage(runtime, event);
      reactToRangerWinterBite(runtime, event);
    },
    'buff.applied': reactToSoulbeastBuff
  }
};
