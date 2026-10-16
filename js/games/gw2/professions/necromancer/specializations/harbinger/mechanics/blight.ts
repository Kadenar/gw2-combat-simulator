import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import {
  harbingerBlightConsumed,
  harbingerShroudEntered
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
import { HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import {
  addBlight,
  harbingerBlightMaximum,
  consumeBlight,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { doomApproachesBlightProfile } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

const BLIGHT = 'harbinger.blight-clock';

/** One replaceable wake owns the next actual accrual, expiry, or Meltdown deadline. */
function refreshBlight(runtime: NecromancerRuntime): void {
  const state = harbingerState.from(runtime);
  runtime.cancelOwner({ id: BLIGHT, generation: state.blightGeneration });
  state.blightGeneration++;
  const at = Math.min(state.nextBlightAt ?? Infinity, ...state.blightExpiries, state.meltdownUntil || Infinity);

  if (Number.isFinite(at)) runtime.schedule(BLIGHT, at, null, { id: BLIGHT, generation: state.blightGeneration }, -20);
}

/** Reports current Blight without replaying a state snapshot into the combat world. */
export function publishBlight(runtime: NecromancerRuntime): void {
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
export function spendBlight(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): boolean {
  const state = harbingerState.from(runtime);
  const cost = balanceNumberFromContext(
    runtime,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(cast.skill.id)],
    'blightCost'
  );
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, runtime.time, harbingerBlightMaximum(runtime)) : 0;
  runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed, at: runtime.time, activationId: cast.id });

  publishBlight(runtime);
  return empowered;
}

/** Every shroud exit stops Blight accrual, including automatic life-force depletion. */
function initializeHarbingerBlight(runtime: NecromancerRuntime): void {
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
}

/** Accrual and expiry share one replaceable wake so spending observes settled Blight. */
const harbingerBlightTasks = {
  [BLIGHT](runtime) {
    const state = harbingerState.from(runtime);
    purgeHarbingerTimedState(state, runtime.time, harbingerBlightMaximum(runtime));

    if (state.meltdownUntil && state.meltdownUntil <= runtime.time) state.meltdownUntil = 0;

    if (runtime.profession.core.activeShroud === 'harbinger' && Number(state.nextBlightAt) <= runtime.time) {
      addBlight(
        state,
        balanceNumberFromContext(runtime, doomApproachesBlightProfile(runtime), 'blightGain'),
        runtime.time,
        harbingerBlightMaximum(runtime)
      );
      state.nextBlightAt = runtime.time + 1;
    }

    publishBlight(runtime);
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']>;

/** Blight initialization and expiry share one owner. */
export const harbingerBlightLifecycle = {
  tasks: harbingerBlightTasks,
  initialize: initializeHarbingerBlight
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
