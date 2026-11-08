import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { effectFirstAt } from '#gw2/platform/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { publishBlight, spendBlight } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import { harbingerElixirLaunched } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
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
  runtime.fireTrigger(harbingerElixirLaunched, { cast });

  // Launch selects empowerment; the impact samples damage modifiers after its own Blight grant.
  runtime.scheduleForCast(IMPACT, impactAt, cast, { empowered });
}

/** Elixir acceptance queues its launch; only launch spends Blight and selects empowerment. */
const harbingerElixirActions = {
  'harbinger.elixir-launch'(runtime, context) {
    if (context.kind !== 'cast' || context.cast.cancelledBeforeCommit) return;

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
    const { cast, empowered } = data as {
      cast: RuntimeCast<NecromancerSkill>;
      empowered: boolean;
    };
    const action = requireSkillAction(cast.skill, 'empowered');
    addBlight(
      harbingerState.from(runtime.profession),
      skillNumber(cast.skill, 'blightGain'),
      runtime.time,
      harbingerBlightMaximum(runtime.helpers)
    );
    // The elixir's Blight grant contributes to its own damage, including when the grant reaches the cap.
    const blight = harbingerState.from(runtime.profession).blightExpiries.length;
    publishBlight(runtime);
    runtime.effects.emit({
      kind: 'profile',
      profile: cast.skill,
      effects: (empowered ? action.effects : (cast.skill.effects ?? [])).map((effect): SkillEffect => ({
        ...effect,
        // The task has already waited for impact; emit the chosen payload now without applying its cast offsets again.
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
