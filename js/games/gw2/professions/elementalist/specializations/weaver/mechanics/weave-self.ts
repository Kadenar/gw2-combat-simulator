import { buffDeadlineActive } from '#gw2/platform/combat/buff-expiry.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { gw2TimerDeadline } from '#gw2/platform/combat/effect-timing.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

const WEAVE_SELF_ACTIVATION_TASK = 'elementalist.weave-self-activation';
const WOVEN_BUFFS = ['weave self fire', 'weave self water', 'weave self air', 'weave self earth'];

/** Replacing or consuming the form ends old applications before granting another window. */
function endWovenBuffs(context: ElementalistRuntime, at: number): void {
  for (const kind of ['perfect weave', ...WOVEN_BUFFS]) context.combat.endBuffs(kind, at, () => true);
}

/**
 * Schedules Weave Self's activation at the same partial-cast point where the platform starts its recharge
 * (`rechargeProgress`), so the form and its cooldown share one authored boundary.
 */
export function startWeaveSelfCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const at = cast.start + (cast.fullEnd - cast.start) * skillNumber(skill, 'rechargeProgress');

  // Activation must occur within the cast lifetime, including its exact final instant.
  if (gw2Time(at) > cast.effectiveEnd) return;

  context.schedule(WEAVE_SELF_ACTIVATION_TASK, at, skill.id, { id: cast.id, generation: 0 });
}

/** Opens the Weave Self window and seeds it with the current attunement. */
function handleWeaveSelfActivation(
  context: ElementalistRuntime,
  data: unknown,
  emissionCast?: EffectDelivery['cast']
): void {
  const state = weaverState.from(context.profession);
  const core = professionCoreState(context.profession);
  const at = context.time;
  const sourceId = data as Skill['id'];
  const duration = skillNumber(requireSkill(context.helpers, ID.WEAVE_SELF), 'duration');
  endWovenBuffs(context, at);
  // Availability and emitted temporary buffs expire on the same combat tick.
  state.weaveSelfUntil = gw2TimerDeadline(at, duration);
  state.weaveSelfVisited = [core.primaryAttunement];
  state.perfectWeaveUntil = 0;

  context.effects.emit(
    elementalistBuffRequest(
      {
        skill: elementalistEventSkill(context, 'Weave Self', sourceId),
        at,
        source: 'Weave Self',
        sourceId,
        actorType: ACTOR.PLAYER,
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
  cause: SimulationEvent
): void {
  const state = weaverState.from(context.profession);

  if (!buffDeadlineActive(state.weaveSelfUntil, at)) return;

  // Attunement completion already applied recharge; this observer only advances Weave Self's buffs and visited elements.
  const visited = new Set(state.weaveSelfVisited);
  visited.add(target);
  state.weaveSelfVisited = [...visited];
  // Partial elemental bonuses share the original deadline, so revisiting an element cannot extend Weave Self.
  const remaining = Math.max(0, state.weaveSelfUntil - at);

  if (visited.size < ELEMENTALIST_ATTUNEMENTS.length) {
    context.effects.emit(
      elementalistBuffRequest({
        cause,
        skill: elementalistEventSkill(context, source, sourceId),
        at,
        source,
        sourceId,
        actorType: ACTOR.PLAYER,
        kind: `weave self ${target.toLowerCase()}`,
        stacks: 1,
        duration: remaining,
        skillName: source
      })
    );
    return;
  }

  endWovenBuffs(context, at);
  state.weaveSelfUntil = 0;
  state.weaveSelfVisited = [];
  // Perfect Weave is Weave Self's follow-up window: Tailored Victory stays available for its flip duration.
  const perfectWeaveDuration = skillNumber(requireSkill(context.helpers, ID.WEAVE_SELF), 'flipDuration');
  state.perfectWeaveUntil = gw2TimerDeadline(at, perfectWeaveDuration);
  for (const kind of ['perfect weave', ...WOVEN_BUFFS]) {
    context.effects.emit(
      elementalistBuffRequest({
        cause,
        skill: elementalistEventSkill(context, source, sourceId),
        at,
        source,
        sourceId,
        actorType: ACTOR.PLAYER,
        kind,
        stacks: 1,
        duration: perfectWeaveDuration,
        skillName: source
      })
    );
  }
}

/** Tailored Victory requires the live Perfect Weave window created by Weave Self. */
export function weaveSelfAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult {
  // Tailored Victory is the Weave Self flipover and only exists while Perfect
  // Weave is up.
  if (skill.id !== ID.TAILORED_VICTORY) return { ready: true };

  const state = weaverState.from(context.profession);
  return buffDeadlineActive(state.perfectWeaveUntil, context.time)
    ? { ready: true }
    : denySkillCast(skill, 'elementalist.weaver-perfect-weave', `requires Perfect Weave.`);
}

/** Weave Self owns activation and consumption of its Perfect Weave follow-up window. */
const weaveSelfTasks = {
  [WEAVE_SELF_ACTIVATION_TASK]: handleWeaveSelfActivation,
  'elementalist.weaver.consume-perfect-weave'(runtime) {
    weaverState.from(runtime.profession).perfectWeaveUntil = 0;
    endWovenBuffs(runtime, runtime.time);
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['tasks']>;

/** Weave Self activation and Perfect Weave work share one owner; the skill's data anchors its recharge. */
export const weaveSelfLifecycle = {
  tasks: weaveSelfTasks
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
