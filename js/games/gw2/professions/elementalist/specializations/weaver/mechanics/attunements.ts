import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { denyCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/mechanics/attunement-cooldowns.js';
import type {
  ElementalistAttunementSwap,
  ElementalistTransitionDelivery
} from '#gw2/professions/elementalist/core/mechanics/attunement-transition.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { attunementsCounted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import {
  weaverHammerAvailability,
  weaverWeaponAttunementAvailable
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import {
  weaverAttunementCompleted,
  weaverHandsChanged,
  weaverUnraveled
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/trigger-points.js';
import {
  applyWeaveSelfAttunement,
  weaveSelfAvailability
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { flowStateAttunementReduction } from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Base attunement recharge after a dual swap.
const WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;

/** Shorter base attunement recharge while Weave Self is active; exported for its tooltip. */
export const WEAVE_SELF_ATTUNEMENT_RECHARGE_SECONDS = 2;

// Enforce Weaver's dual-hand attunement model, Unravel replacement state, and
// specialization-only skill gates before Core evaluates ordinary weapon rules.
function weaverAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult {
  const hammerAvailability = weaverHammerAvailability(context, skill);

  // Eligible orbs still pass through the shared hand and Unravel replacement gates below.
  if (hammerAvailability && !hammerAvailability.ready) return hammerAvailability;

  // Only the preserved next autoattack link may bypass hand checks after a swap.
  const core = professionCoreState(context.profession);
  const chainPosition = context.helpers.autoattackChainPositions.get(Number(skill.id));
  const carriedLink =
    chainPosition &&
    Number(skill.id) !== chainPosition.rootSkillId &&
    core.autoattackCarryover?.root === chainPosition.rootSkillId &&
    core.autoattackCarryover.attunement === skill.attunement &&
    context.autoattackController.read(chainPosition.rootSkillId) === Number(skill.id);

  if (skill.type === 'Weapon' && skill.attunement && !carriedLink) {
    const state = weaverState.from(context.profession);
    const attunement = skill.attunement;
    const secondary = state.secondaryAttunement;
    const unravelActive = state.unravelUntil > context.time;
    const available = weaverWeaponAttunementAvailable(skill, core.primaryAttunement, secondary, unravelActive);

    if (!available) {
      return denyCast(
        unravelActive ? 'elementalist.unravel-attunement' : 'elementalist.weaver-attunement',
        unravelActive
          ? `${skill.name} is unavailable - requires ${core.primaryAttunement} while Unravel is active.`
          : `${skill.name} is unavailable - requires ${attunement} in the matching Weaver hand.`
      );
    }
  }

  return weaveSelfAvailability(context, skill);
}

/** Settle hand rewards at the deferred transition phase, after Core entry effects. */
export function settleWeaverAttunement(
  context: ElementalistRuntime,
  { transition, cause }: ElementalistTransitionDelivery<ElementalistAttunementSwap>
): void {
  const state = weaverState.from(context.profession);
  const at = transition.at;
  const target = transition.to;
  const sourceId = transition.sourceId;
  const source = transition.source;
  const unravelActive = state.unravelUntil > at;

  // Fully attuned setup swaps can carry Elements of Rage into the opener.
  context.fireTrigger(weaverHandsChanged, { transition, cause });
  applyWeaveSelfAttunement(context, at, target, source, sourceId, cause);

  // Pre-combat setup swaps must not generate trait procs.
  if (canonicalTime(at) < (context.engagement.startTime || 0)) return;

  context.fireTrigger(weaverAttunementCompleted, { transition, cause });
  // A normal Weaver swap moves both hands and so counts as two attunement
  // changes; under Unravel the hands move together and it counts as one.
  context.fireTrigger(attunementsCounted, { at, stacks: unravelActive ? 1 : 2, sourceId, cause });
}

/** The family coordinator prepares both hands before shared attunement completion effects. */
export function completeDualAttunement(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = weaverState.from(context.profession),
    core = professionCoreState(context.profession),
    at = context.time,
    skill = cast.skill;
  const target = targetAttunement(skill);

  if (target) {
    const previous = core.primaryAttunement;
    state.secondaryAttunement = state.unravelUntil > at ? target : previous;
    onAttunementComplete(context, cast, skill, target, {
      secondaryAttunement: state.secondaryAttunement,
      rechargeDuration: elementalistAttunementRechargeDuration(
        context,
        skill,
        state.weaveSelfUntil > at ? WEAVE_SELF_ATTUNEMENT_RECHARGE_SECONDS : WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS,
        flowStateAttunementReduction(context.helpers, context)
      )
    });
  }
}

/** Unravel and primary-hand refreshes settle through the same dual-attunement owner. */
const weaverAttunementActions = {
  'elementalist.weaver.unravel'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Unravel requires a cast trigger.');

    // Run after this cast's completion traits, before another priority -100 completion can observe its hands.
    runtime.scheduleForCast('elementalist.weaver.unravel', runtime.time, context.cast, {}, undefined, -101);
  },
  // The spear dual declarations refresh only the primary element live at commitment.
  'elementalist.weaver.refresh-primary-attunement'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Attunement refresh requires a cast trigger.');

    const core = professionCoreState(runtime.profession);

    if (core.primaryAttunement !== weaverState.from(runtime.profession).secondaryAttunement)
      setElementalistAttunementReadyAt(runtime, core.primaryAttunement, context.cast.effectiveEnd);
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['sideEffectHandlers']>;

/** Unravel unifies the hands after completion traits and before the next same-time cast. */
const weaverAttunementTasks = {
  'elementalist.weaver.unravel'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    // Task data is cloned; resolve the immutable payload from this accepted cast's selected skill.
    const action = requireSkillAction(skill, 'unravel');
    const at = cast.effectiveEnd;
    const core = professionCoreState(context.profession);
    const state = weaverState.from(context.profession);
    {
      const previousPrimary = core.primaryAttunement;
      const previousSecondary = state.secondaryAttunement;
      state.secondaryAttunement = core.primaryAttunement;
      state.unravelUntil = at + skillNumber(skill, 'duration');
      core.attunementEnteredAt = at;
      context.effects.emit({
        kind: 'packet',
        event: {
          type: 'elementalist.attunement',
          at,
          priority: -20,
          source: skill.name,
          sourceId: skill.id,
          actorType: ACTOR.PLAYER,
          skillId: skill.id,
          skillName: skill.name,
          from: previousPrimary,
          fromSecondaryAttunement: previousSecondary,
          to: core.primaryAttunement,
          secondaryAttunement: state.secondaryAttunement
        }
      });
      for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
        setElementalistAttunementReadyAt(context, attunement, at);
      }

      const boon = requireEffect(skill, 'boon', previousPrimary, action);

      if (boon) {
        const boonKind = String(boon.boon).toLowerCase();
        context.effects.emit(
          elementalistBuffRequest(
            {
              skill: skill,
              at: cast.effectiveEnd,
              source: skill.name,
              sourceId: skill.id,
              actorType: ACTOR.PLAYER,
              name: skill.name,
              kind: boonKind,
              duration: boon.duration,
              stacks: Number(boon.stacks)
            },
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      }

      context.fireTrigger(weaverUnraveled, { cast, previousPrimary, previousSecondary });
    }
  }
} satisfies NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['tasks']>;

/** Unravel actions and hand eligibility remain owned by Weaver. */
export const weaverAttunementLifecycle = {
  sideEffectHandlers: weaverAttunementActions,
  tasks: weaverAttunementTasks,
  availability: weaverAvailability
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
