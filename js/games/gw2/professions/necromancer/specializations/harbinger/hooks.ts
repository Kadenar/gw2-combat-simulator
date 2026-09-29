import { effectFirstAt, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { emitHarbingerEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/emission.js';
import { HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import {
  addBlight,
  consumeBlight,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import {
  applyBolsteringBrew,
  applyCascadingCorruption,
  applyHarbingerEntryTraits,
  doomApproachesBlightProfile,
  doomApproachesControl,
  harbingerResolverEventReactions,
  initializeAlchemicVigor,
  twistedMedicineAudience
} from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type { NecromancerRuntime, NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';
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
  runtime.emit({
    type: 'buff',
    at: runtime.time,
    source: 'necromancer',
    sourceId: ID.HARBINGER_SHROUD,
    actorType: 'player',
    skillName: 'Blight',
    kind: 'harbinger-blight',
    stacks: state.blight,
    duration: state.blight ? Math.max(...state.blightExpiries) - runtime.time : 0
  });
  refreshBlight(runtime);
}

/** Spending counts once at commitment; only the delayed explosion can damage the target. */
function spendBlight(runtime: NecromancerRuntime, cast: RuntimeCast): boolean {
  const state = harbingerState.from(runtime);
  const profile = requireBalanceProfileFromContext(
    runtime,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
  );
  const cost = balanceProfileNumber(profile, 'blightCost');
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, runtime.time) : 0;
  applyCascadingCorruption(runtime, cast, consumed);

  publishBlight(runtime);
  return empowered;
}

/** Elixir launch spends live Blight before queuing its independent local and hostile impact. */
function launchElixir(runtime: NecromancerRuntime, cast: RuntimeCast, impactAt: number): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  applyBolsteringBrew(runtime, cast);

  runtime.scheduleForCast(IMPACT, impactAt, cast, { empowered, blight });
}

/** Movement launch carries the post-spend snapshot; its authored control receives the trait replacement. */
function launchMovement(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blight;
  const profile = empowered
    ? requireBalanceProfileFromContext(runtime, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)])
    : cast.skill;
  emitHarbingerEffects(
    runtime,
    cast.skill,
    [
      ...(profile.effects ?? []),
      ...(empowered ? (cast.skill.effects?.filter((effect) => effect.type === 'control') ?? []) : [])
    ].map((effect) => doomApproachesControl(runtime, effect)),
    cast,
    {
      necromancerBlight: blight
    }
  );
}

/** Blight lives on the one runtime; shroud callbacks own every entry and exit, including automatic depletion. */
export const harbingerHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  initialize(runtime) {
    initializeAlchemicVigor(runtime);

    registerNecromancerShroudLifecycle(runtime, 'harbinger.shroud', {
      onEnter(skill) {
        if (skill.shroudEntry !== 'harbinger') return;
        harbingerState.from(runtime).nextBlightAt = Math.floor(runtime.time) + 1;
        applyHarbingerEntryTraits(runtime, skill);
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
      if (at <= cast.effectiveEnd) runtime.scheduleForCast(MOVEMENT, at, cast);
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
      const { cast, impactAt } = data as { cast: RuntimeCast; impactAt: number };
      launchElixir(runtime, cast, impactAt);
    },
    [MOVEMENT](runtime, data) {
      launchMovement(runtime, (data as { cast: RuntimeCast }).cast);
    },
    [IMPACT](runtime, data) {
      const { cast, empowered, blight } = data as { cast: RuntimeCast; empowered: boolean; blight: number };
      const profile = requireBalanceProfileFromContext(
        runtime,
        HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)]
      );
      addBlight(harbingerState.from(runtime), balanceProfileNumber(profile, 'blightGain'), runtime.time);
      publishBlight(runtime);
      emitHarbingerEffects(
        runtime,
        cast.skill,
        ((empowered ? profile : cast.skill).effects ?? []).map((effect) => ({
          ...effect,
          atMs: 0,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          audience: twistedMedicineAudience(runtime, effect)
        })),
        cast,
        { necromancerBlight: blight }
      );
    }
  },
  reactions: { 'damage.resolved': harbingerResolverEventReactions.damage }
};
