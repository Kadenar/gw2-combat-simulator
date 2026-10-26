import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceNumberFromContext,
  effectNumber,
  skillNumber,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  lastBlazeBerserkExtension,
  smashBrawlerBerserkExtension
} from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

const BERSERK_EXPIRE = 'warrior.berserk-expiry';

// Base extensions are selected by the committed Rage skill and combined with trait extensions once.
const berserkExtensions = new WeakMap<RuntimeCast<WarriorSkill>, number>();

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

/** Berserk changes the shared pool cap; refresh clamps entry and preserves the remaining balance on expiry. */
const berserkerAdrenalinePolicy: typeof coreAdrenalinePolicy = {
  ...coreAdrenalinePolicy,
  // Build-only resource views have catalog/config but no live mode; they use the starting Core cap.
  maximum: (runtime) =>
    'profession' in runtime && berserkerState.from(runtime).berserkUntil != null
      ? balanceNumberFromContext(runtime, TRAIT.PRIMAL_RAGE, 'maximumStacks')
      : coreAdrenalinePolicy.maximum(runtime)
};

/** The status and expiry task share one deadline; older wakes cannot close a refreshed mode. */
function publishBerserk(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>, until: number): void {
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Berserker',
      sourceId: ID.BERSERK,
      actorType: ACTOR.EFFECT,
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      name: 'Berserk',
      kind: 'berserk',
      stacks: 1,
      duration: until - runtime.time
    }
  });
  runtime.schedule(BERSERK_EXPIRE, until, until, undefined, -220);
}

/** Completed activation opens or extends the current mode; expiring during a cast cannot revive it. */
function completeBerserk(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  const state = berserkerState.from(runtime);
  const skill = cast.skill;

  if (skill.id === ID.BERSERK) {
    runtime.fireTrigger(berserkEntered, { cast });
    return;
  }

  // An unbounded preview window is already held open and must not schedule a finite extension.
  if (state.berserkUntil == null || !Number.isFinite(state.berserkUntil)) return;

  const extension =
    (berserkExtensions.get(cast) ?? 0) +
    smashBrawlerBerserkExtension(runtime, cast) +
    lastBlazeBerserkExtension(runtime, cast);

  if (extension > 0) {
    state.berserkUntil = gw2EffectExpiresAt(state.berserkUntil, extension);
    publishBerserk(runtime, cast, state.berserkUntil);
  }
}

/** Entry and base extension capture share the mode owner with completion and expiry. */
const berserkActions: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['sideEffectHandlers'] = {
  'warrior.berserk-spend'(runtime, context) {
    runtime.resourceController.spend('adrenaline', context.skill.adrenalineCost ?? 0);
  },
  'warrior.berserk-enter'(runtime, context) {
    if (context.kind !== 'cast') return;

    const cast = context.cast;
    const state = berserkerState.from(runtime);
    const profile = cast.skill;
    const action = requireSkillAction(profile, 'berserk');
    const effect = requireEffect(profile, 'buff', 'berserk', action);

    if (effect && effectNumber(profile, effect, 'duration') > 0) {
      state.berserkUntil = gw2EffectExpiresAt(runtime.time, effectNumber(profile, effect, 'duration'));
      // Mode entry changes capacity without refilling the pool.
      runtime.resourceController.refresh('adrenaline');
      publishBerserk(runtime, cast, state.berserkUntil);
    }
  },
  'warrior.berserk-extension'(_runtime, context) {
    // Capture the committed skill's selected base amount before combining trait extensions.
    if (context.kind === 'cast') berserkExtensions.set(context.cast, skillNumber(context.skill, 'durationExtension'));
  }
};

/** Keep entry, extensions, availability, capacity, and stale-expiry protection in one mode lifecycle. */
export const berserkLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  resources: { adrenaline: berserkerAdrenalinePolicy },
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    // Primal bursts require Berserk; ordinary attacks can inspect either form without a prerequisite cast.
    const state = berserkerState.from(runtime);
    state.berserkUntil = skill?.primalBurst || inputs.berserk ? Infinity : null;
  },
  availability(runtime, skill) {
    const state = berserkerState.from(runtime);

    if (skill.primalBurst && state.berserkUntil == null)
      return { ready: false, retryAt: null, code: 'warrior.berserk', reason: 'Primal bursts require berserk mode.' };

    if (skill.id === ID.BERSERK && state.berserkUntil != null)
      return {
        ready: false,
        retryAt: state.berserkUntil,
        code: 'warrior.berserk-active',
        reason: 'Already in berserk mode.'
      };

    return { ready: true };
  },
  sideEffectHandlers: {
    ...berserkActions,
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

      state.berserkUntil = null;
      runtime.resourceController.refresh('adrenaline');
    }
  }
};
