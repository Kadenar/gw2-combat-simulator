import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { berserkSkillActions } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import {
  BERSERK_EXPIRE,
  berserkerState,
  berserkExtensions,
  publishBerserk
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  berserkEntryTraits,
  berserkerCompletionTraits,
  berserkTraitExtension
} from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Completed activation opens or extends the current mode; expiring during a cast cannot revive it. */
function completeBerserk(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const state = berserkerState.from(runtime);
  const skill = cast.skill;
  if (skill.id === ID.BERSERK) {
    berserkEntryTraits(runtime, cast);
    return;
  }

  if (!state.berserkActive) return;
  const extension = (berserkExtensions.get(cast) ?? 0) + berserkTraitExtension(runtime, cast);

  if (extension > 0) {
    state.berserkUntil = gw2EffectExpiresAt(state.berserkUntil, extension);
    publishBerserk(runtime, cast);
  }
}

/** Berserker composes with Core's resource and packet owners; only this slice owns mode and aura lifetimes. */
export const berserkerHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    if (skill?.primalBurst) berserkerState.from(runtime).berserkUntil = Infinity;
  },

  availability(runtime, skill) {
    const state = berserkerState.from(runtime);
    if (skill.primalBurst && !state.berserkActive)
      return { ready: false, retryAt: null, code: 'warrior.berserk', reason: 'Primal bursts require berserk mode.' };
    if (skill.id === ID.BERSERK && state.berserkActive)
      return {
        ready: false,
        retryAt: state.berserkUntil,
        code: 'warrior.berserk-active',
        reason: 'Already in berserk mode.'
      };
    return { ready: true };
  },
  // Queue the profile's Burning on full completion; mode extension remains with its state owner.

  sideEffectHandlers: {
    ...berserkSkillActions,
    // The live catalog defines eligibility, including patched primal skills; ordinary recharges are untouched.
    'warrior.reset-primal-bursts'(runtime) {
      for (const skill of runtime.helpers.skills) if (skill.primalBurst) runtime.cooldownController.clear(skill.id);
    }
  },
  onCastCommit(runtime, cast) {
    completeBerserk(runtime, cast);
    berserkerCompletionTraits(runtime, cast);
  },
  tasks: {
    [BERSERK_EXPIRE](runtime, deadline) {
      const state = berserkerState.from(runtime);
      if (state.berserkUntil !== deadline) return;
      state.berserkActive = false;
      state.berserkUntil = 0;
      runtime.profession.core.maximumAdrenaline = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, CORE_PROFILE.resources),
        'maximumStacks'
      );
      runtime.profession.core.adrenaline = Math.min(
        runtime.profession.core.adrenaline,
        runtime.profession.core.maximumAdrenaline
      );
    }
  }
};
