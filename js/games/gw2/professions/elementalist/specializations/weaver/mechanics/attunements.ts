import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { denyCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/mechanics/attunement-cooldowns.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  registerElementalistAttunementTransition,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { attunementsCounted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { ELEMENTALIST_ATTUNEMENTS, isElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
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

// Starting hands describe the equipped state; only an actual attunement transition grants Elements of Rage.
function initializeWeaverAttunements(context: ElementalistRuntime): void {
  registerElementalistEliteEvents(context, (runtime, event) => {
    onAcceptedEvent(runtime, event);
  });
  registerElementalistAttunementTransition(context, completeDualAttunement);
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  state.secondaryAttunement = isElementalistAttunement(context.config.secondaryAttunement)
    ? context.config.secondaryAttunement
    : core.primaryAttunement;
}

// Enforce Weaver's dual-hand attunement model, Unravel replacement state, and
// specialization-only skill gates before Core evaluates ordinary weapon rules.
function weaverAvailability(context: MechanicQueriesOf<ElementalistRuntime>, skill: Skill): AvailabilityResult {
  const hammerAvailability = weaverHammerAvailability(context, skill);

  // Eligible orbs still pass through the shared hand and Unravel replacement gates below.
  if (hammerAvailability && !hammerAvailability.ready) return hammerAvailability;

  // Only the preserved next autoattack link may bypass hand checks after a swap.
  const core = professionCoreState(context);
  const chainPosition = context.helpers.autoattackChainPositions.get(Number(skill.id));
  const carriedLink =
    chainPosition &&
    Number(skill.id) !== chainPosition.root &&
    core.autoattackCarryover?.root === chainPosition.root &&
    core.autoattackCarryover.attunement === skill.attunement &&
    core.autoattackChains[chainPosition.root] === Number(skill.id);

  if (skill.type === 'Weapon' && skill.attunement && !carriedLink) {
    const state = weaverState.from(context);
    const attunement = String(skill.attunement);
    const secondary = state.secondaryAttunement || core.primaryAttunement;
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

// On every attunement swap keep the hands in sync, advance Weave Self, and fire the swap-triggered Weaver traits.
function onAcceptedEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  // Unravel emits its own attunement event from onCastCommit and handles the
  // whole transition there, so it is skipped here.
  if (
    event.type !== 'elementalist.attunement' ||
    event.skillId === ID.UNRAVEL ||
    !isElementalistAttunement(event.to) ||
    !isElementalistAttunement(event.from)
  ) {
    return;
  }

  const state = weaverState.from(context);
  const at = event.at;
  const target = event.to;
  const sourceId = event.skillId ?? event.sourceId;
  const source = event.skillName || event.source || 'Attunement';
  const unravelActive = state.unravelUntil > at;

  // While Unravel is active both hands follow the swap, so the recorded event
  // has to advertise the same element for the off hand.
  if (unravelActive) {
    state.secondaryAttunement = target;
  }

  // Fully attuned setup swaps can carry Elements of Rage into the opener.
  context.fireTrigger(weaverHandsChanged, { event });
  applyWeaveSelfAttunement(context, at, target, source, sourceId);

  // Pre-combat setup swaps must not generate trait procs.
  if (canonicalTime(at) < (context.engagement.startTime || 0)) return;

  context.fireTrigger(weaverAttunementCompleted, { event });
  // A normal Weaver swap moves both hands and so counts as two attunement
  // changes; under Unravel the hands move together and it counts as one.
  context.fireTrigger(attunementsCounted, { at, stacks: unravelActive ? 1 : 2, sourceId });
}

/** Core calls the elite transition once before shared attunement completion effects. */
function completeDualAttunement(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = weaverState.from(context),
    core = professionCoreState(context),
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
        flowStateAttunementReduction(context)
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

    const core = professionCoreState(runtime);

    if (core.primaryAttunement !== weaverState.from(runtime).secondaryAttunement)
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
    const core = professionCoreState(context);
    const state = weaverState.from(context);
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

/** Dual-attunement initialization, availability, transitions, and their scheduled work share one owner. */
export const weaverAttunementLifecycle = {
  sideEffectHandlers: weaverAttunementActions,
  tasks: weaverAttunementTasks,
  initialize: initializeWeaverAttunements,
  availability: weaverAvailability
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
