import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceNumber, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  harbingerBlightConsumed,
  harbingerShroudEntered
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
import {
  addBlight,
  consumeBlight,
  harbingerBlightMaximum,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { doomApproachesBlightProfile } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalInterval, canonicalTime, timeKey } from '#kernel/core/clock.js';

const BLIGHT = 'harbinger.blight-clock';

/** Align accrual to a strictly later clock boundary; disabling accrual must leave stack expiry active. */
function nextBlightAt(runtime: NecromancerRuntime): number {
  const cadence = balanceNumber(runtime.helpers, TRAIT.DARK_DISCIPLE, 'pulseInterval');

  if (cadence <= 0) return Infinity;

  const interval = canonicalInterval(cadence);
  const next = Math.floor(timeKey(runtime.time) / timeKey(interval)) + 1;
  return canonicalTime(next * interval);
}

/** One replaceable wake owns only actual Blight accrual and stack expiry. */
function refreshBlight(runtime: NecromancerRuntime): void {
  const state = harbingerState.from(runtime.profession);
  runtime.cancelOwner({ id: BLIGHT, generation: state.blightGeneration });
  state.blightGeneration++;
  const at = Math.min(state.nextBlightAt ?? Infinity, ...state.blightExpiries);

  if (Number.isFinite(at)) runtime.schedule(BLIGHT, at, null, { id: BLIGHT, generation: state.blightGeneration }, -20);
}

/** Report the current Blight count and reschedule its next update before returning the count. */
function publishBlight(runtime: NecromancerRuntime): number {
  const state = harbingerState.from(runtime.profession);
  const blight = state.blightExpiries.length;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'necromancer',
      sourceId: ID.HARBINGER_SHROUD,
      actorType: ACTOR.PLAYER,
      skillName: 'Blight',
      kind: 'harbinger-blight',
      stacks: blight,
      duration: state.blightExpiries.length ? Math.max(...state.blightExpiries) - runtime.time : 0
    }
  });
  refreshBlight(runtime);
  return blight;
}

/** Apply the cap and refresh stack expiry before returning the Blight count used for skill damage. */
export function grantBlight(runtime: NecromancerRuntime, stacks: number): number {
  addBlight(harbingerState.from(runtime.profession), stacks, runtime.time, harbingerBlightMaximum(runtime.helpers));
  return publishBlight(runtime);
}

/** Spend Blight and run its trait trigger before reporting the remaining stacks and skill empowerment. */
export function spendBlight(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>
): { readonly empowered: boolean; readonly blight: number } {
  const state = harbingerState.from(runtime.profession);
  const cost = skillNumber(cast.skill, 'blightCost');
  const empowered = state.blightExpiries.length >= cost;
  const consumed = empowered ? consumeBlight(state, cost, runtime.time, harbingerBlightMaximum(runtime.helpers)) : 0;
  runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed });

  return { empowered, blight: publishBlight(runtime) };
}

/** Every shroud exit stops Blight accrual, including automatic life-force depletion. */
function initializeHarbingerBlight(runtime: NecromancerRuntime): void {
  registerNecromancerShroudLifecycle(runtime, 'harbinger.shroud', {
    onEnter(skill) {
      if (skill.shroudEntry !== 'harbinger') return;

      harbingerState.from(runtime.profession).nextBlightAt = nextBlightAt(runtime);
      runtime.fireTrigger(harbingerShroudEntered, { skill });
      refreshBlight(runtime);
    },
    onExit() {
      harbingerState.from(runtime.profession).nextBlightAt = Infinity;
      refreshBlight(runtime);
    }
  });
  publishBlight(runtime);
}

/** Accrual and expiry share one replaceable wake so spending observes settled Blight. */
const harbingerBlightTasks = {
  [BLIGHT](runtime) {
    const state = harbingerState.from(runtime.profession);
    purgeHarbingerTimedState(state, runtime.time, harbingerBlightMaximum(runtime.helpers));

    if (runtime.profession.core.activeShroud === 'harbinger' && Number(state.nextBlightAt) <= runtime.time) {
      state.nextBlightAt = nextBlightAt(runtime);
      grantBlight(runtime, balanceNumber(runtime.helpers, doomApproachesBlightProfile(runtime), 'blightGain'));
    } else {
      publishBlight(runtime);
    }
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']>;

/** Blight initialization and expiry share one owner. */
export const harbingerBlightLifecycle = {
  tasks: harbingerBlightTasks,
  initialize: initializeHarbingerBlight
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
