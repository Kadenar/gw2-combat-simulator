/**
 * Owns Weave Self activation, Perfect Weave state, and attunement recharge changes.
 * Skill fragments remain in `skills/slot-skills.ts`.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ScheduledTask, SchedulerRecord, Skill } from '#gw2/platform/engine/types.js';
import { elementalistAlacrityAdjustedDuration } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';

export const WEAVE_SELF_ACTIVATION_TASK = 'elementalist.weave-self-activation';

/** Schedules Weave Self at its profiled mid-cast activation point. */
export function startWeaveSelfCast(context: ElementalistCastContext, skill: Skill): void {
  if (skill.id !== ID.WEAVE_SELF) return;
  const at =
    context.start +
    (context.fullEnd - context.start) *
      balanceProfileValueFromContext(context, PROFILE.resources, 'firstPacketRatio', 0.65);
  if (at > context.effectiveEnd + context.epsilon) return;
  context.tasks.schedule({
    type: WEAVE_SELF_ACTIVATION_TASK,
    at,
    ownerId: context.reservationId,
    payload: { sourceId: skill.id }
  });
}

/** Starts Weave Self's recharge at the same partial-cast point as its activation. */
export function modifyWeaveSelfRechargeStart(context: ElementalistPrecastContext, rechargeStart: number): number {
  if (context.skill.id !== ID.WEAVE_SELF) return rechargeStart;
  return (
    context.start +
    (rechargeStart - context.start) *
      balanceProfileValueFromContext(context, PROFILE.resources, 'firstPacketRatio', 0.65)
  );
}

/** Opens the Weave Self window and seeds it with the current attunement. */
export function handleWeaveSelfActivation(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<SchedulerRecord>
): void {
  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = task.at;
  const sourceId = (task.payload?.sourceId ?? ID.WEAVE_SELF) as Skill['id'];
  const duration = balanceProfileValueFromContext(context, PROFILE.resources, 'durationMultiplier', 20);
  state.weaveSelfUntil = at + duration;
  state.weaveSelfVisited = [core.primaryAttunement];
  state.perfectWeaveUntil = 0;
  if (core.primaryAttunement !== 'Fire' && core.primaryAttunement !== 'Air') return;
  emitSkillBuff(context, elementalistEventSkill(context, 'Weave Self', sourceId), {
    at,
    source: 'Weave Self',
    sourceId,
    actorType: 'player',
    kind: `weave self ${core.primaryAttunement.toLowerCase()}`,
    stacks: 1,
    duration,
    skillName: 'Weave Self'
  });
}

/** Advances Weave Self for one attunement swap and opens Perfect Weave after all four elements. */
export function applyWeaveSelfAttunement(
  context: ElementalistSchedulerContext,
  at: number,
  target: ElementalistAttunement,
  source: string,
  sourceId: Skill['id']
): void {
  const state = weaverState.from(context);
  if (!(state.weaveSelfUntil > at)) return;

  const recharge = elementalistAlacrityAdjustedDuration(
    context as never,
    balanceProfileValueFromContext(context, PROFILE.resources, 'initialDelay', 2)
  );
  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    setElementalistAttunementReadyAt(context, attunement, at + recharge);
  }

  const visited = new Set(state.weaveSelfVisited);
  visited.add(target);
  state.weaveSelfVisited = [...visited];
  const remaining = Math.max(0, state.weaveSelfUntil - at);
  if (target === 'Fire' || target === 'Air') {
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at,
      source,
      sourceId,
      actorType: 'player',
      kind: `weave self ${target.toLowerCase()}`,
      stacks: 1,
      duration: remaining,
      skillName: source
    });
  }

  if (visited.size < ELEMENTALIST_ATTUNEMENTS.length) return;
  state.weaveSelfUntil = 0;
  state.weaveSelfVisited = [];
  const perfectWeaveDuration = balanceProfileValueFromContext(context, PROFILE.resources, 'recharge', 10);
  state.perfectWeaveUntil = at + perfectWeaveDuration;
  for (const kind of ['perfect weave', 'weave self fire', 'weave self air']) {
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at,
      source,
      sourceId,
      actorType: 'player',
      kind,
      stacks: 1,
      duration: perfectWeaveDuration,
      skillName: source
    });
  }
}
