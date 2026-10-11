import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { harbingerBuffPolicies } from '#gw2/professions/necromancer/specializations/harbinger/effect-state.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import {
  harbingerBlightConsumed,
  harbingerElixirLaunched,
  harbingerShroudEntered,
  harbingerStrike
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/combat-boundaries.js';
import { HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import {
  addBlight,
  BLIGHT_MAXIMUM_STACKS,
  consumeBlight,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import {
  doomApproachesBlightProfile,
  doomApproachesControl,
  twistedMedicineAudience
} from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const BLIGHT = 'harbinger.blight-clock';
const COMMIT = 'harbinger.blight-commit';
const IMPACT = 'harbinger.elixir-impact';
const MOVEMENT = 'harbinger.movement-impact';

/** One replaceable wake owns the next actual accrual, expiry, or Meltdown deadline. */
function refreshBlight(runtime: NecromancerRuntime): void {
  const state = harbingerState.from(runtime);
  runtime.cancelOwner({ id: BLIGHT, generation: state.blightGeneration });
  state.blightGeneration++;
  const at = Math.min(state.nextBlightAt ?? Infinity, ...state.blightExpiries, state.meltdownUntil || Infinity);
  if (Number.isFinite(at)) runtime.schedule(BLIGHT, at, null, { id: BLIGHT, generation: state.blightGeneration }, -20);
}

/** Reports current Blight without replaying a state snapshot into the combat world. */
function publishBlight(runtime: NecromancerRuntime): void {
  const state = harbingerState.from(runtime);
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.HARBINGER_SHROUD,
      actorType: 'player',
      skillName: 'Blight',
      kind: 'harbinger-blight',
      stacks: state.blight,
      duration: state.blight ? Math.max(...state.blightExpiries) - runtime.time : 0
    }
  });
  refreshBlight(runtime);
}

/** Spending counts once at commitment; only the delayed explosion can damage the target. */
function spendBlight(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): boolean {
  const state = harbingerState.from(runtime);
  const profile = requireBalanceProfileFromContext(
    runtime,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
  );
  const cost = balanceProfileNumber(profile, 'blightCost');
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, runtime.time) : 0;
  runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed, at: runtime.time, activationId: cast.id });

  publishBlight(runtime);
  return empowered;
}

/** Elixir launch spends live Blight before queuing its independent local and hostile impact. */
function launchElixir(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>, impactAt: number): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  runtime.fireTrigger(harbingerElixirLaunched, { cast, at: runtime.time, activationId: cast.id });

  runtime.scheduleForCast(IMPACT, impactAt, cast, { empowered, blight });
}

/** Movement launch carries the post-spend snapshot; its authored control receives the trait replacement. */
function launchMovement(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  const profile = empowered
    ? requireBalanceProfileFromContext(runtime, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)])
    : cast.skill;
  runtime.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    effects: [
      ...(profile.effects ?? []),
      ...(empowered ? (cast.skill.effects?.filter((effect) => effect.type === 'control') ?? []) : [])
    ].map((effect) => doomApproachesControl(runtime, effect)),
    ...harbingerCastEmissionPolicy(cast, cast.skill, { necromancerBlight: blight })
  });
}

/** Blight lives on the one runtime; shroud callbacks own every entry and exit, including automatic depletion. */
export const harbingerHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  buffPolicies: harbingerBuffPolicies,
  // Devouring Cut recharges during its final 80 ms, including casts shortened by interruption.
  rechargeStart(_context, cast, at) {
    return cast.skill.id === ID.DEVOURING_CUT ? Math.max(cast.start, cast.effectiveEnd - 0.08) : at;
  },
  // Observe the same retained pools and mode flags that Harbinger combat mutates.
  observeEffects(runtime) {
    const state = harbingerState.from(runtime);
    return [
      timedEffectState(
        'harbinger-blight',
        state.blightExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
        BLIGHT_MAXIMUM_STACKS,
        { name: 'Blight' }
      ),
      timedEffectState(
        'harbinger-shroud',
        runtime.profession.core.activeShroud ? [{ stacks: 1, expiresAt: null }] : [],
        1,
        { name: 'Harbinger Shroud' }
      ),
      timedEffectState('meltdown', [{ stacks: 1, expiresAt: state.meltdownUntil }], 1)
    ];
  },
  initialize(runtime) {
    registerNecromancerShroudLifecycle(runtime, 'harbinger.shroud', {
      onEnter(skill) {
        if (skill.shroudEntry !== 'harbinger') return;
        harbingerState.from(runtime).nextBlightAt = Math.floor(runtime.time) + 1;
        runtime.fireTrigger(harbingerShroudEntered, { skill, at: runtime.time });
        refreshBlight(runtime);
      },
      onExit() {
        harbingerState.from(runtime).nextBlightAt = Infinity;
        refreshBlight(runtime);
      }
    });
    publishBlight(runtime);
  },

  sideEffectHandlers: {
    'harbinger.elixir-launch'(runtime, context) {
      if (context.kind !== 'cast' || context.cast.cancelled) return;
      const cast = context.cast;
      const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
      const impactAt = strike
        ? effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, strike))
        : cast.fullEnd;
      const at = canonicalTime(cast.start + 0.36);
      runtime.scheduleForCast(COMMIT, at, cast, { impactAt: Math.max(at, canonicalTime(impactAt)) });
    },
    'harbinger.movement-launch'(runtime, context, action) {
      if (context.kind !== 'cast') return;
      const cast = context.cast;
      if (action.type !== 'harbinger.movement-launch' || action.amount == null)
        throw new TypeError('Movement launch requires progress.');
      const progress = sideEffectAmount(runtime, action.amount);
      const at = canonicalTime(
        cast.start + quantizeGw2ActionTimingMs((cast.fullEnd - cast.start) * progress * 1000) / 1000
      );
      // A committed movement cast keeps its delayed payload and Blight spend after interruption.
      if (!cast.cancelled || at <= cast.effectiveEnd) runtime.scheduleForCast(MOVEMENT, at, cast);
    }
  },

  tasks: {
    [BLIGHT](runtime) {
      const state = harbingerState.from(runtime);
      purgeHarbingerTimedState(state, runtime.time);
      if (state.meltdownUntil && state.meltdownUntil <= runtime.time) state.meltdownUntil = 0;
      if (runtime.profession.core.activeShroud === 'harbinger' && Number(state.nextBlightAt) <= runtime.time) {
        const profile = requireBalanceProfileFromContext(runtime, doomApproachesBlightProfile(runtime));
        addBlight(state, balanceProfileNumber(profile, 'blightGain'), runtime.time);
        state.nextBlightAt = runtime.time + 1;
      }

      publishBlight(runtime);
    },
    [COMMIT](runtime, data) {
      const { cast, impactAt } = data as { cast: RuntimeCast<NecromancerSkill>; impactAt: number };
      launchElixir(runtime, cast, impactAt);
    },
    [MOVEMENT](runtime, data) {
      launchMovement(runtime, (data as { cast: RuntimeCast<NecromancerSkill> }).cast);
    },
    [IMPACT](runtime, data) {
      const { cast, empowered, blight } = data as {
        cast: RuntimeCast<NecromancerSkill>;
        empowered: boolean;
        blight: number;
      };
      const profile = requireBalanceProfileFromContext(
        runtime,
        HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
      );
      addBlight(harbingerState.from(runtime), balanceProfileNumber(profile, 'blightGain'), runtime.time);
      publishBlight(runtime);
      runtime.effects.emit({
        kind: 'profile',
        profile: cast.skill,
        effects: ((empowered ? profile : cast.skill).effects ?? []).map((effect): SkillEffect => ({
          ...effect,
          atMs: 0,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          audience: twistedMedicineAudience(runtime, effect)
        })),
        ...harbingerCastEmissionPolicy(cast, cast.skill, { necromancerBlight: blight })
      });
    }
  },
  reactions: { 'damage.resolved': (runtime, event) => runtime.fireTrigger(harbingerStrike, { event }) }
};
