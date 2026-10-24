import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { publishBlight, spendBlight } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import { harbingerElixirLaunched } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
import { HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import {
  addBlight,
  harbingerBlightMaximum,
  harbingerState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { twistedMedicineAudience } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const COMMIT = 'harbinger.blight-commit';

const IMPACT = 'harbinger.elixir-impact';

/** Elixir launch spends live Blight before queuing its independent local and hostile impact. */
function launchElixir(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>, impactAt: number): void {
  const empowered = spendBlight(runtime, cast);
  const blight = harbingerState.from(runtime).blightExpiries.length;
  runtime.fireTrigger(harbingerElixirLaunched, { cast });

  runtime.scheduleForCast(IMPACT, impactAt, cast, { empowered, blight });
}

/** Elixir acceptance queues its launch; only launch spends Blight and selects empowerment. */
const harbingerElixirActions = {
  'harbinger.elixir-launch'(runtime, context) {
    if (context.kind !== 'cast' || context.cast.cancelled) return;

    const cast = context.cast;
    const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
    const impactAt = strike
      ? effectFirstAt(cast.start, cast.fullEnd, scaleCastBoundTiming(cast, cast.skill, strike))
      : cast.fullEnd;
    const at = canonicalTime(cast.start + 0.36);
    runtime.scheduleForCast(COMMIT, at, cast, { impactAt: Math.max(at, canonicalTime(impactAt)) });
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']>;

/** Elixir impacts retain launch empowerment and apply their own Blight gain before emission. */
const harbingerElixirTasks = {
  [COMMIT](runtime, data) {
    const { cast, impactAt } = data as { cast: RuntimeCast<NecromancerSkill>; impactAt: number };
    launchElixir(runtime, cast, impactAt);
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
    addBlight(
      harbingerState.from(runtime),
      balanceProfileNumber(profile, 'blightGain'),
      runtime.time,
      harbingerBlightMaximum(runtime)
    );
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
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']>;

/** Elixir launch actions and their impact tasks share one owner. */
export const harbingerElixirLifecycle = {
  sideEffectHandlers: harbingerElixirActions,
  tasks: harbingerElixirTasks
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
