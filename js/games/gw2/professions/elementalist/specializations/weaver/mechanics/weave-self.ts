import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { EPSILON } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
/**
 * Owns Weave Self activation, Perfect Weave state, and attunement recharge changes.
 * Skill fragments remain in `skills/slot-skills.ts`.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/live-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

export const WEAVE_SELF_ACTIVATION_TASK = 'elementalist.weave-self-activation';

/** Schedules Weave Self at its profiled mid-cast activation point. */
export function startWeaveSelfCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (skill.id !== ID.WEAVE_SELF) return;
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const at = cast.start + (cast.fullEnd - cast.start) * balanceProfileNumber(resourcesProfile, 'firstPacketRatio');
  if (at > cast.effectiveEnd + EPSILON) return;
  context.schedule(WEAVE_SELF_ACTIVATION_TASK, at, skill.id, { id: cast.id, generation: 0 });
}

/** Starts Weave Self's recharge at the same partial-cast point as its activation. */
export function modifyWeaveSelfRechargeStart(
  context: ElementalistRuntime,
  cast: Pick<RuntimeCast, 'skill' | 'start' | 'fullEnd' | 'effectiveEnd'>,
  rechargeStart: number
): number {
  if (cast.skill.id !== ID.WEAVE_SELF) return rechargeStart;
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return context.time + (rechargeStart - context.time) * balanceProfileNumber(resourcesProfile, 'firstPacketRatio');
}

/** Opens the Weave Self window and seeds it with the current attunement. */
export function handleWeaveSelfActivation(context: ElementalistRuntime, data: unknown): void {
  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = context.time;
  const sourceId = data as Skill['id'];
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const duration = balanceProfileNumber(resourcesProfile, 'durationMultiplier');
  // Availability and emitted temporary buffs expire on the same combat tick.
  state.weaveSelfUntil = gw2EffectExpiresAt(at, duration);
  state.weaveSelfVisited = [core.primaryAttunement];
  state.perfectWeaveUntil = 0;
  if (core.primaryAttunement !== 'Fire' && core.primaryAttunement !== 'Air') return;
  emitElementalistBuff(context, {
    skill: elementalistEventSkill(context, 'Weave Self', sourceId),
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
  context: ElementalistRuntime,
  at: number,
  target: ElementalistAttunement,
  source: string,
  sourceId: Skill['id']
): void {
  const state = weaverState.from(context);
  if (!(state.weaveSelfUntil > at)) return;

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  // Attunement completion already applied recharge; this observer only advances Weave Self's buffs and visited elements.
  const visited = new Set(state.weaveSelfVisited);
  visited.add(target);
  state.weaveSelfVisited = [...visited];
  const remaining = Math.max(0, state.weaveSelfUntil - at);
  if (target === 'Fire' || target === 'Air') {
    emitElementalistBuff(context, {
      skill: elementalistEventSkill(context, source, sourceId),
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
  const perfectWeaveDuration = balanceProfileNumber(resourcesProfile, 'recharge');
  state.perfectWeaveUntil = gw2EffectExpiresAt(at, perfectWeaveDuration);
  for (const kind of ['perfect weave', 'weave self fire', 'weave self air']) {
    emitElementalistBuff(context, {
      skill: elementalistEventSkill(context, source, sourceId),
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
