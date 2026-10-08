import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { canonicalTime } from '#kernel/core/clock.js';
/**
 * Owns Weave Self activation, Perfect Weave state, and attunement recharge changes.
 * Skill fragments remain in `skills/slot-skills.ts`.
 */
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
export const WEAVE_SELF_ACTIVATION_TASK = 'elementalist.weave-self-activation';

/** Schedules Weave Self at its profiled mid-cast activation point. */
export function startWeaveSelfCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const at = cast.start + (cast.fullEnd - cast.start) * balanceProfileNumber(resourcesProfile, 'firstPacketRatio');
  // Activation must occur within the cast lifetime, including its exact final instant.
  if (canonicalTime(at) > cast.effectiveEnd) return;
  context.schedule(WEAVE_SELF_ACTIVATION_TASK, at, skill.id, { id: cast.id, generation: 0 });
}

/** Starts Weave Self's recharge at the same partial-cast point as its activation. */
export function modifyWeaveSelfRechargeStart(
  context: import('#gw2/platform/profession-definition/runtime-context.js').RechargeStartContext,
  cast: Pick<RuntimeCast<ElementalistSkill>, 'skill' | 'start' | 'fullEnd' | 'effectiveEnd'>,
  rechargeStart: number
): number {
  if (cast.skill.id !== ID.WEAVE_SELF) return rechargeStart;
  const resourcesProfile = context.requireBalanceProfile(PROFILE.resources);
  return context.time + (rechargeStart - context.time) * balanceProfileNumber(resourcesProfile, 'firstPacketRatio');
}

/** Opens the Weave Self window and seeds it with the current attunement. */
export function handleWeaveSelfActivation(
  context: ElementalistRuntime,
  data: unknown,
  emissionCast?: EffectDelivery['cast']
): void {
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
  context.effects.emit(
    elementalistBuffRequest(
      {
        skill: elementalistEventSkill(context, 'Weave Self', sourceId),
        at,
        source: 'Weave Self',
        sourceId,
        actorType: 'player',
        kind: `weave self ${core.primaryAttunement.toLowerCase()}`,
        stacks: 1,
        duration,
        skillName: 'Weave Self'
      },
      emissionCast
    )
  );
}

/** Advances Weave Self for one attunement swap and opens Perfect Weave after all four elements. */
export function applyWeaveSelfAttunement(
  context: ElementalistRuntime,
  at: number,
  target: ElementalistAttunement,
  source: string,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
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
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, source, sourceId),
          at,
          source,
          sourceId,
          actorType: 'player',
          kind: `weave self ${target.toLowerCase()}`,
          stacks: 1,
          duration: remaining,
          skillName: source
        },
        emissionCast
      )
    );
  }

  if (visited.size < ELEMENTALIST_ATTUNEMENTS.length) return;
  state.weaveSelfUntil = 0;
  state.weaveSelfVisited = [];
  const perfectWeaveDuration = balanceProfileNumber(resourcesProfile, 'recharge');
  state.perfectWeaveUntil = gw2EffectExpiresAt(at, perfectWeaveDuration);
  for (const kind of ['perfect weave', 'weave self fire', 'weave self air']) {
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, source, sourceId),
          at,
          source,
          sourceId,
          actorType: 'player',
          kind,
          stacks: 1,
          duration: perfectWeaveDuration,
          skillName: source
        },
        emissionCast
      )
    );
  }
}
