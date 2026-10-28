import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { completeThiefSteal } from '#gw2/professions/thief/core/mechanics/steal.js';
import { stealAccepted } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import {
  maliceGained,
  markCompleted
} from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import type { DeadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { initialMalice, stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Deadeye's Mark commits the target and stolen-skill transaction through its skill-owned action. */
export const DEADEYE_MARK_SKILLS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DEADEYES_MARK]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 30,

    stealTraitSkill: true,
    movementSkill: true,
    cooldown: 25,
    initiativeCost: 0,

    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.deadeyes-mark' } }]
  }
});

const DEADEYE_MARK_EXPIRY = 'thief.deadeye-mark-expire';
/**
 * Marking a target refreshes the mark; re-marking the same live target adds to its malice instead of resetting it.
 * The mark also grants Deadeye's stolen skills and schedules its own expiry.
 */
function completeDeadeyesMark(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = deadeyeState.from(runtime);
  runtime.fireTrigger(stealAccepted, { cast });
  const remarking = state.markedTargetId === 'primary-target' && state.markExpiresAt > runtime.time;
  state.markedTargetId = 'primary-target';
  state.markExpiresAt = canonicalTime(runtime.time + skillNumberFromContext(runtime, ID.DEADEYES_MARK, 'duration'));
  state.markGeneration += 1;

  if (remarking) runtime.resourceController.grant('malice', initialMalice(runtime));
  else runtime.resourceController.replace('malice', initialMalice(runtime));

  if (!remarking) state.maleficentSevenTriggered = false;

  runtime.fireTrigger(maliceGained, { cast });
  completeThiefSteal(runtime, stolenSkillGrant(runtime));
  runtime.fireTrigger(markCompleted, { cast });

  runtime.schedule(DEADEYE_MARK_EXPIRY, state.markExpiresAt, { generation: state.markGeneration });
}

/** Mark expiry resets malice; a stale expiry from an earlier mark is ignored. */
function expireDeadeyesMark(runtime: ThiefRuntime, data: unknown): void {
  const state = deadeyeState.from(runtime);

  if ((data as { generation: number }).generation !== state.markGeneration || runtime.time < state.markExpiresAt)
    return;

  state.markedTargetId = null;
  state.markExpiresAt = 0;
  runtime.resourceController.replace('malice', 0);
  state.maleficentSevenTriggered = false;
}

/** Modifier eligibility reads the active specialization mark, including detached previews. */
export function markedTarget(context: Gw2ModifierContext): boolean {
  const state = thiefRuntimeSpecializationState<DeadeyeState>(context, 'Deadeye');
  return Boolean(state.markedTargetId) && (state.markExpiresAt || Infinity) > context.time;
}

/** Malice rewards and cast snapshots require a mark still active at the live combat clock. */
export function deadeyeMarked(runtime: ThiefRuntime): boolean {
  const at = runtime.time;
  const state = deadeyeState.from(runtime);
  return Boolean(state.markedTargetId) && state.markExpiresAt > at;
}

/** Register actions beside the skills whose accepted casts select them. */
const deadeyesMarkActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> = {
  'thief.deadeyes-mark'(runtime, context) {
    if (context.kind === 'cast') completeDeadeyesMark(runtime, context.cast);
  }
};

/** Deadeye's Mark application and expiry share one owner. */
export const deadeyesMarkLifecycle = {
  sideEffectHandlers: deadeyesMarkActions,
  tasks: { [DEADEYE_MARK_EXPIRY]: expireDeadeyesMark }
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
