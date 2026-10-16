import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { spendBlight } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import { HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { doomApproachesControl } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const MOVEMENT = 'harbinger.movement-impact';

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

/** Movement attacks queue their committed action and spend Blight when that action settles. */
const harbingerShroudActions = {
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
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']>;

/** Movement effects use the Blight and empowerment selected by their launch. */
const harbingerShroudTasks = {
  [MOVEMENT](runtime, data) {
    launchMovement(runtime, (data as { cast: RuntimeCast<NecromancerSkill> }).cast);
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']>;

/** Harbinger shroud actions and their impact tasks share one owner. */
export const harbingerShroudLifecycle = {
  sideEffectHandlers: harbingerShroudActions,
  tasks: harbingerShroudTasks
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
