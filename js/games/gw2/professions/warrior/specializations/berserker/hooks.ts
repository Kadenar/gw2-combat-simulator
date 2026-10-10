import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  berserkerBuffPolicies,
  berserkerEffectStates
} from '#gw2/professions/warrior/specializations/berserker/effect-state.js';
import { berserkerAdrenalinePolicy } from '#gw2/professions/warrior/specializations/berserker/mechanics/resources.js';
import { berserkSkillActions } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import {
  BERSERK_EXPIRE,
  berserkerState,
  berserkExtensions,
  publishBerserk
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  lastBlazeBerserkExtension,
  smashBrawlerBerserkExtension
} from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Completed activation opens or extends the current mode; expiring during a cast cannot revive it. */
function completeBerserk(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const state = berserkerState.from(runtime);
  const skill = cast.skill;
  if (skill.id === ID.BERSERK) {
    runtime.fireTrigger(berserkEntered, { cast });
    return;
  }

  // An unbounded preview window is already held open and must not schedule a finite extension.
  if (!state.berserkActive || !Number.isFinite(state.berserkUntil)) return;
  const extension =
    (berserkExtensions.get(cast) ?? 0) +
    smashBrawlerBerserkExtension(runtime, cast) +
    lastBlazeBerserkExtension(runtime, cast);

  if (extension > 0) {
    state.berserkUntil = gw2EffectExpiresAt(state.berserkUntil, extension);
    publishBerserk(runtime, cast);
  }
}

/** Berserker composes with Core's resource and packet owners; only this slice owns mode and aura lifetimes. */
export const berserkerHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  resources: { adrenaline: berserkerAdrenalinePolicy },
  buffPolicies: berserkerBuffPolicies,
  observeEffects: berserkerEffectStates,
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    // Primal bursts require Berserk; ordinary attacks can inspect either form without a prerequisite cast.
    const state = berserkerState.from(runtime);
    state.berserkActive = Boolean(skill?.primalBurst || inputs.berserk);
    state.berserkUntil = state.berserkActive ? Infinity : 0;
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
    runtime.fireTrigger(berserkerCastCompleted, { cast });
  },
  tasks: {
    [BERSERK_EXPIRE](runtime, deadline) {
      const state = berserkerState.from(runtime);
      if (state.berserkUntil !== deadline) return;
      state.berserkActive = false;
      state.berserkUntil = 0;
      runtime.resourceController.refresh('adrenaline');
    }
  }
};

/** Accepted Berserk entry grants the intrinsic boon before the selected entry reward. */
export const berserkEntered = defineTriggerPoint<{ readonly cast: RuntimeCast<WarriorSkill> }>(
  'warrior.berserk-entered',
  [TRAIT.BURST_OF_AGGRESSION, TRAIT.BLOODY_ROAR]
);

/** Completion observes the new mode deadline before boon and aura reactions. */
export const berserkerCastCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<WarriorSkill> }>(
  'warrior.berserker-cast-completed',
  [TRAIT.HEAT_THE_SOUL, TRAIT.KING_OF_FIRES]
);
