import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { specterBuffPolicies } from '#gw2/professions/thief/specializations/specter/effect-state.js';
import {
  SHADOW_DEPLETED,
  setShadowShroud,
  shadowDepleted,
  shadowForce,
  specterAvailability
} from '#gw2/professions/thief/specializations/specter/mechanics/shadow-shroud.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { grantBarrier } from '#gw2/professions/thief/specializations/specter/skills/barrier.js';
import { completeSiphon } from '#gw2/professions/thief/specializations/specter/skills/siphon.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Specter hooks: Shadow Force and its shroud, Siphon, shroud skill traits, Dark Sentry, and Larcenous Torment. */
export const specterHooks: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  buffPolicies: specterBuffPolicies,
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    specterState.from(runtime).shadowShroudActive = Boolean(skill?.shadowShroudSkill);
  },

  sideEffectHandlers: {
    'thief.siphon'(runtime, context) {
      if (context.kind === 'cast') completeSiphon(runtime, context.cast);
    },
    'thief.enter-shadow-shroud'(runtime, context) {
      specterState.from(runtime).shadowShroudExitReadyAt = runtime.time + 0.5;
      setShadowShroud(runtime, true, context.skill);
    },
    'thief.exit-shadow-shroud'(runtime, context) {
      setShadowShroud(runtime, false, context.skill);
    },
    'thief.shroud-entry-barrier'(runtime, context) {
      if (context.kind === 'cast')
        grantBarrier(runtime, context.cast, PROFILE.enterShadowShroud, 'Enter Shadow Shroud - Barrier');
    },
    'thief.dawns-barrier'(runtime, context) {
      // The intrinsic barrier is independent of Shadestep's cast-commit reward.
      if (context.kind === 'cast')
        grantBarrier(runtime, context.cast, PROFILE.dawnsReposeBarrier, "Dawn's Repose - Barrier");
    }
  },

  resources: { shadowForce },
  availability: specterAvailability,
  onCastStart(runtime, cast) {
    // Shared start payment precedes this conversion of gross initiative cost into Shadow Force.
    const cost = cast.skill.initiativeCost || 0;
    if (cost > 0)
      runtime.resourceController.grant(
        'shadowForce',
        cost * balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'resourceGain')
      );
  },
  onCooldownReset(runtime) {
    // The training-area reset refills Shadow Force without forcing Specter out of Shadow Shroud.
    runtime.resourceController.grant('shadowForce', specterState.from(runtime).shadowClock.maximum);
  },

  tasks: {
    [SHADOW_DEPLETED]: shadowDepleted
  }
};
