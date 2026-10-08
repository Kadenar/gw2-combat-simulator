import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denyCast, denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  registerElementalistAttunementTransition,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  setElementalistAttunementReadyAt
} from '#gw2/professions/elementalist/core/state.js';
import { triggerBountifulPower } from '#gw2/professions/elementalist/core/traits/arcane/attunement-swap.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { weaverBuffPolicies } from '#gw2/professions/elementalist/specializations/weaver/effect-state.js';
import {
  weaverDualAttunements,
  weaverHammerAvailability,
  weaverPistolSideEffects,
  weaverWeaponAttunementAvailable
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import {
  primordialStancePulse,
  schedulePrimordialStance
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';
import {
  applyWeaveSelfAttunement,
  handleWeaveSelfActivation,
  modifyWeaveSelfRechargeStart,
  startWeaveSelfCast,
  WEAVE_SELF_ACTIVATION_TASK
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import {
  applyElementsOfRageAttunement,
  applyUnravelElementsOfRage,
  applyWeaverCastTraits,
  applyWeaversProwess,
  flowStateAttunementReduction,
  initializeElementsOfRage
} from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;
// Seed the off-hand element from the build (falling back to the starting
// attunement) and, when both hands open on the same element, carry Elements of
// Rage into the opener the way a real fully-attuned swap would.
function initialize(context: ElementalistRuntime): void {
  registerElementalistEliteEvents(context, (runtime, event) => {
    onAcceptedEvent(runtime, event);
  });
  registerElementalistAttunementTransition(context, completeDualAttunement);
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  state.secondaryAttunement = isElementalistAttunement(context.config.secondaryAttunement)
    ? context.config.secondaryAttunement
    : core.primaryAttunement;
  initializeElementsOfRage(context);
}

// Enforce Weaver's dual-hand attunement model, Unravel replacement state, and
// specialization-only skill gates before Core evaluates ordinary weapon rules.
function availability(context: MechanicQueriesOf<ElementalistRuntime>, skill: Skill): AvailabilityResult {
  const hammerAvailability = weaverHammerAvailability(context, skill);
  // Eligible orbs still pass through the shared hand and Unravel replacement gates below.
  if (hammerAvailability && !hammerAvailability.ready) return hammerAvailability as AvailabilityResult;
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

  // Tailored Victory is the Weave Self flipover and only exists while Perfect
  // Weave is up.
  if (skill.id !== ID.TAILORED_VICTORY) return { ready: true };
  const state = weaverState.from(context);
  return state.perfectWeaveUntil > context.time
    ? { ready: true }
    : denySkillCast(skill, 'elementalist.weaver-perfect-weave', `requires Perfect Weave.`);
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
  applyElementsOfRageAttunement(context, event, undefined);
  applyWeaveSelfAttunement(context, at, target, source, sourceId, undefined);
  // Pre-combat setup swaps must not generate trait procs.
  if (canonicalTime(at) < (context.combatStartTime || 0)) return;
  applyWeaversProwess(context, event, undefined);
  // A normal Weaver swap moves both hands and so counts as two attunement
  // changes; under Unravel the hands move together and it counts as one.
  triggerBountifulPower(context, at, unravelActive ? 1 : 2, sourceId, undefined);
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
        state.weaveSelfUntil > at
          ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'initialDelay')
          : WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS,
        flowStateAttunementReduction(context)
      )
    });
  }
}

// Commit dual-weapon and stance state at completion; Core owns the registered attunement transition.
function onCastCommit(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = weaverState.from(context);
  const at = cast.effectiveEnd;
  const dualAttunements = weaverDualAttunements(skill);
  // An attunement cast pushes the old main-hand element into the off hand
  // (under Unravel both hands land on the target instead) and puts all four
  // attunements on one shared dual recharge, with trait reductions and recharge
  // speed applied in order by the shared attunement-duration calculation.
  if (targetAttunement(skill)) return;
  applyWeaverCastTraits(context, cast, skill, dualAttunements);
  // Swift Revenge pays out per element of the dual skill that was just cast.
  // Dual attacks claim Superior Elements at completion, before attempting its Weakness packet.
  // Dual attacks grant Might only while the stance is armed and strictly unexpired.
  if (dualAttunements && state.ferventStanceUntil > 0 && state.ferventStanceUntil > at) {
    const ferventStanceProfile = requireBalanceProfileFromContext(context, PROFILE.ferventStance);
    const might = requireEffect(ferventStanceProfile, 'boon', 'Might');
    if (might) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: 'Fervent Stance',
            sourceId: skill.id,
            actorType: 'player',
            kind: String(might.boon).toLowerCase(),
            stacks: Number(might.stacks),
            duration: might.duration,
            skillName: 'Fervent Stance'
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
}

/** Native tasks own Weave Self and stance pulses; actual controls and swaps own their trait reactions. */
export const weaverHooks: RuntimeHooks<ElementalistRuntimeState, ElementalistSkill> = {
  buffPolicies: weaverBuffPolicies,
  initialize,
  availability,
  // The Air bullet and Flow State reductions compose without consuming bullet state during lookup.
  rechargeRules: [
    {
      when: (context, skill) => skill.id === ID.PURBLINDING_PLASMA && professionCoreState(context).pistolBullets.Air,
      multiplier: { profile: PROFILE.purblindingPlasma, field: 'rechargeMultiplier' }
    }
  ],
  rechargeStart: modifyWeaveSelfRechargeStart,
  // Dual orbs share their cast lifetime so Grand Finale retires both hands' pending contacts.
  effectOwner(context, event) {
    const skill = context.skillFor(event.skillId ?? event.sourceId);
    if (
      skill &&
      skillWeapon(skill) === 'Hammer' &&
      weaverDualAttunements(skill) &&
      (event.type === 'damage' || event.type === 'condition')
    )
      return { id: String(event.activationId), generation: 0 };
    return undefined;
  },
  sideEffectHandlers: {
    'elementalist.weaver.unravel'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Unravel requires a cast trigger.');
      // Run after this cast's completion traits, before another priority -100 completion can observe its hands.
      runtime.scheduleForCast('elementalist.weaver.unravel', runtime.time, context.cast, {}, undefined, -101);
    },
    ...weaverPistolSideEffects,
    // The spear dual declarations refresh only the primary element live at commitment.
    'elementalist.weaver.refresh-primary-attunement'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Attunement refresh requires a cast trigger.');
      const core = professionCoreState(runtime);
      if (core.primaryAttunement !== weaverState.from(runtime).secondaryAttunement)
        setElementalistAttunementReadyAt(runtime, core.primaryAttunement, context.cast.effectiveEnd);
    },
    'elementalist.weaver.start-weave-self'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Weave Self requires a cast trigger.');
      startWeaveSelfCast(runtime, context.cast, context.skill);
    },
    'elementalist.weaver.start-primordial-stance'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Primordial Stance requires a cast trigger.');
      schedulePrimordialStance(runtime, context.cast, context.skill);
    }
  },
  onCastCommit(runtime, cast) {
    onCastCommit(runtime, cast, cast.skill);
  },
  // Accepted player control grants Swiftness; attunement transitions keep their separate observer.
  tasks: {
    'elementalist.weaver.unravel'(context, data) {
      const { cast } = data as SkillTaskData<ElementalistSkill>;
      const skill = cast.skill;
      const at = cast.effectiveEnd;
      const core = professionCoreState(context);
      const state = weaverState.from(context);
      {
        const previousPrimary = core.primaryAttunement;
        const previousSecondary = state.secondaryAttunement;
        state.secondaryAttunement = core.primaryAttunement;
        const unravelProfile = requireBalanceProfileFromContext(context, PROFILE.unravel);
        state.unravelUntil = at + balanceProfileNumber(unravelProfile, 'durationMultiplier');
        core.attunementEnteredAt = at;
        context.effects.emit({
          kind: 'packet',
          event: {
            type: 'elementalist.attunement',
            at,
            priority: -20,
            source: skill.name,
            sourceId: skill.id,
            actorType: 'player',
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

        const profiledBoon = requireEffect(unravelProfile, 'boon', previousPrimary);
        if (profiledBoon) {
          const boonKind = String(profiledBoon.boon).toLowerCase();
          context.effects.emit(
            elementalistBuffRequest(
              {
                skill: skill,
                at: cast.effectiveEnd,
                source: skill.name,
                sourceId: skill.id,
                actorType: 'player',
                name: skill.name,
                kind: boonKind,
                duration: profiledBoon.duration,
                stacks: Number(profiledBoon.stacks)
              },
              { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
            )
          );
        }

        applyUnravelElementsOfRage(context, cast, previousPrimary, previousSecondary);
      }
    },
    [WEAVE_SELF_ACTIVATION_TASK]: handleWeaveSelfActivation,
    'elementalist.primordial-stance': primordialStancePulse,
    'elementalist.weaver.consume-perfect-weave'(runtime) {
      weaverState.from(runtime).perfectWeaveUntil = 0;
    },
    'elementalist.weaver.arm-fervent-stance'(runtime) {
      weaverState.from(runtime).ferventStanceUntil =
        runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.ferventStance), 'durationMultiplier');
    }
  }
};
