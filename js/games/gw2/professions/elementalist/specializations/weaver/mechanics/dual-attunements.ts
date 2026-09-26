import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import { registerElementalistAttunementTransition } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Weaver's dual-attunement mechanic.
 *
 * The Elementalist core owns the main-hand (primary) attunement; this module
 * owns the off-hand element and everything that follows from the pair: the
 * slot-based cast gates, the shared attunement recharge an attunement cast
 * imposes, the Unravel / Weave Self / Perfect Weave windows, Primordial Stance
 * pulses, and the traits that react to swaps and dual-skill completions.
 */
import { denySkillCast } from '#gw2/professions/shared/availability.js';
import { denyCast } from '#gw2/platform/engine/skills/availability.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import { EPSILON, canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import {
  modifyWeaverAttributes,
  weaverModifierRules
} from '#gw2/professions/elementalist/specializations/weaver/traits/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { triggerBountifulPower } from '#gw2/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';

import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import {
  elementalistEventSkill,
  emitProfiledBuff,
  emitProfiledCondition,
  skillWeapon
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  applyWeaverHammerState,
  applyWeaverPistolState,
  weaverDualAttunements,
  weaverHammerAvailability
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import {
  applyWeaveSelfAttunement,
  handleWeaveSelfActivation,
  modifyWeaveSelfRechargeStart,
  startWeaveSelfCast,
  WEAVE_SELF_ACTIVATION_TASK
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/weave-self.js';
import {
  schedulePrimordialStance,
  primordialStancePulse
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';

const WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;
const PRIMORDIAL_STANCES = new Set([
  ID.PRIMORDIAL_STANCE_FIRE,
  ID.PRIMORDIAL_STANCE_WATER,
  ID.PRIMORDIAL_STANCE_AIR,
  ID.PRIMORDIAL_STANCE_EARTH
]);

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
  if (core.primaryAttunement === state.secondaryAttunement && hasTrait(context, 'Elements of Rage')) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, PROFILE.elementsOfRage);
    emitElementalistBuff(context, {
      skill: elementalistEventSkill(context, 'Starting Attunement', 'starting-attunement'),
      at: context.time,
      source: 'Starting Attunement',
      sourceId: 'starting-attunement',
      actorType: 'player',
      kind: 'elements of rage',
      stacks: 1,
      duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
      skillName: 'Starting Attunement'
    });
  }
}

// Enforce Weaver's dual-hand attunement model, Unravel replacement state, and
// specialization-only skill gates before Core evaluates ordinary weapon rules.
function availability(context: ElementalistRuntime, skill: Skill): AvailabilityResult {
  if (skill.id === ID.UNRAVEL && !hasTrait(context, 'Elements of Rage')) {
    return denySkillCast(skill, 'elementalist.weaver-elements-of-rage', `requires Elements of Rage.`);
  }

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
    const dualAttunements = weaverDualAttunements(skill);
    const required = dualAttunements || [attunement];
    const secondary = state.secondaryAttunement || core.primaryAttunement;
    const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
    // Slots 1-2 come from the main hand and 4-5 from the off hand; slot 3 is the
    // dual skill, which needs both of its elements attuned (a single-element
    // slot 3 therefore needs both hands on that element). Unravel collapses the
    // bar to single-element skills of the current primary attunement.
    const unravelActive = weaverState.from(context).unravelUntil > context.time;
    const available = unravelActive
      ? required.length === 1 && required[0] === core.primaryAttunement
      : dualAttunements
        ? slot === 3 &&
          required.every((element) => [core.primaryAttunement, secondary].includes(element as ElementalistAttunement))
        : slot <= 2
          ? required[0] === core.primaryAttunement
          : slot >= 4
            ? required[0] === secondary
            : core.primaryAttunement === secondary && required[0] === core.primaryAttunement;
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

// React to accepted events: Elemental Pursuit on player control effects, and
// on every attunement swap keep the hands in sync, advance Weave Self, and fire
// the swap-triggered Weaver traits.
function onAcceptedEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  if (event.type === 'control' && event.actorType === 'player' && hasTrait(context, 'Elemental Pursuit')) {
    emitProfiledBuff(
      context,
      event.at,
      PROFILE.elementalPursuit,
      'Swiftness',
      'Elemental Pursuit',
      event.skillId ?? event.sourceId
    );
  }

  // Unravel emits its own attunement event from onCastComplete and handles the
  // whole transition there, so it is skipped here.
  if (
    event.type !== 'elementalist.attunement' ||
    event.skillName === 'Unravel' ||
    !isElementalistAttunement(event.to) ||
    !isElementalistAttunement(event.from)
  ) {
    return;
  }

  const state = weaverState.from(context);
  const at = event.at;
  const target = event.to;
  const previous = event.from;
  const sourceId = event.skillId ?? event.sourceId;
  const source = String(event.skillName || event.source || 'Attunement');
  const unravelActive = state.unravelUntil > at;

  // While Unravel is active both hands follow the swap, so the recorded event
  // has to advertise the same element for the off hand.
  if (unravelActive) {
    state.secondaryAttunement = target;
  }

  // Fully attuned setup swaps can carry Elements of Rage into the opener.
  if ((target === previous || unravelActive) && hasTrait(context, 'Elements of Rage')) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, PROFILE.elementsOfRage);
    emitElementalistBuff(context, {
      skill: elementalistEventSkill(context, source, sourceId),
      at,
      source,
      sourceId,
      actorType: 'player',
      kind: 'elements of rage',
      stacks: 1,
      duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
      skillName: source
    });
  }

  applyWeaveSelfAttunement(context, at, target, source, sourceId);

  // Pre-combat setup swaps must not generate trait procs.
  if (at < Number(context.combatStartTime || 0) - EPSILON) return;
  if (hasTrait(context, "Weaver's Prowess") && (unravelActive || target === previous)) {
    const weaversProwessProfile = requireBalanceProfileFromContext(context, PROFILE.weaversProwess);
    const resistance = requireEffect(weaversProwessProfile, 'boon', 'Resistance');
    if (resistance) {
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, "Weaver's Prowess", sourceId),
        at,
        source: "Weaver's Prowess",
        sourceId,
        actorType: 'player',
        kind: String(resistance.boon).toLowerCase(),
        stacks: Number(resistance.stacks),
        duration: Number(resistance.duration),
        skillName: "Weaver's Prowess"
      });
    }
  }

  // A normal Weaver swap moves both hands and so counts as two attunement
  // changes; under Unravel the hands move together and it counts as one.
  triggerBountifulPower(context, at, unravelActive ? 1 : 2, sourceId);
}

/** Core calls the elite transition once before shared attunement completion effects. */
function completeDualAttunement(context: ElementalistRuntime, cast: RuntimeCast): void {
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
        at
      )
    });
  }
}

// Commit dual-weapon and stance state at completion; Core owns the registered attunement transition.
function onCastComplete(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = cast.effectiveEnd;
  const dualAttunements = weaverDualAttunements(skill);
  // An attunement cast pushes the old main-hand element into the off hand
  // (under Unravel both hands land on the target instead) and puts all four
  // attunements on one shared dual recharge, with trait reductions and recharge
  // speed applied in order by the shared attunement-duration calculation.
  if (targetAttunement(skill)) return;

  applyWeaverPistolState(context, cast, skill);
  applyWeaverHammerState(context, cast, skill);

  if (hasTrait(context, 'Bolstered Elements') && skill.skillFamily === 'Stance') {
    emitProfiledBuff(context, at, PROFILE.bolsteredElements, 'Protection', skill.name, skill.id);
  }

  // Swift Revenge pays out per element of the dual skill that was just cast.
  if (hasTrait(context, 'Swift Revenge') && dualAttunements) {
    for (const element of dualAttunements) {
      if (element === 'Fire') {
        emitProfiledBuff(context, at, PROFILE.swiftRevenge, 'Fire', skill.name, skill.id);
      } else if (element === 'Air') {
        emitProfiledBuff(context, at, PROFILE.swiftRevenge, 'Air', skill.name, skill.id);
      } else if (element === 'Earth') {
        const swiftRevengeProfile = requireBalanceProfileFromContext(context, PROFILE.swiftRevenge);

        context.endurance.grant(balanceProfileNumber(swiftRevengeProfile, 'resourceGain'));
      }
    }
  }

  // Superior Elements applies Weakness on dual attacks behind its own internal
  // cooldown, tracked in Weaver state.
  if (
    hasTrait(context, 'Superior Elements') &&
    dualAttunements &&
    isInternalCooldownReady(at, state.superiorElementsReadyAt)
  ) {
    const superiorElementsProfile = requireBalanceProfileFromContext(context, PROFILE.superiorElements);
    state.superiorElementsReadyAt = at + balanceProfileNumber(superiorElementsProfile, 'internalCooldown');
    emitProfiledCondition(context, at, PROFILE.superiorElements, 'Weakness', skill.name, skill.id);
  }

  // The Spear dual skill makes the main-hand element immediately re-attunable
  // whenever the two hands hold different elements.
  if (
    skillWeapon(skill) === 'Spear' &&
    String(skill.slot || '') === 'Weapon_3' &&
    dualAttunements &&
    core.primaryAttunement !== state.secondaryAttunement
  ) {
    setElementalistAttunementReadyAt(context, core.primaryAttunement, at);
  }

  // Unravel keeps the current element but collapses the off hand onto it for the
  // profiled window, emits the matching swap event itself, clears every
  // attunement recharge, and grants the element's boon (plus Elements of Rage
  // when the hands were previously split).
  if (skill.id === ID.UNRAVEL) {
    const previousPrimary = core.primaryAttunement;
    const previousSecondary = state.secondaryAttunement;
    state.secondaryAttunement = core.primaryAttunement;
    const unravelProfile = requireBalanceProfileFromContext(context, PROFILE.unravel);
    state.unravelUntil = at + balanceProfileNumber(unravelProfile, 'durationMultiplier');
    core.attunementEnteredAt = at;
    context.emit({
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
    });
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at);
    }

    const profiledBoon = requireEffect(unravelProfile, 'boon', previousPrimary);
    if (profiledBoon) {
      const boonKind = String(profiledBoon.boon).toLowerCase();
      emitElementalistBuff(context, {
        skill: skill,
        at: cast.effectiveEnd,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        name: skill.name,
        kind: boonKind,
        duration: Number(profiledBoon.duration),
        stacks: Number(profiledBoon.stacks)
      });
    }

    if (hasTrait(context, 'Elements of Rage') && previousPrimary !== previousSecondary) {
      const elementsOfRageProfile = requireBalanceProfileFromContext(context, PROFILE.elementsOfRage);
      emitElementalistBuff(context, {
        skill: skill,
        at: cast.effectiveEnd,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        name: skill.name,
        kind: 'elements of rage',
        duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
        stacks: 1
      });
    }
  }

  // Dual attacks grant Might only while the stance is armed and strictly unexpired.
  if (dualAttunements && state.ferventStanceUntil > 0 && state.ferventStanceUntil > at) {
    const ferventStanceProfile = requireBalanceProfileFromContext(context, PROFILE.ferventStance);
    const might = requireEffect(ferventStanceProfile, 'boon', 'Might');
    if (might) {
      emitElementalistBuff(context, {
        skill: skill,
        at,
        source: 'Fervent Stance',
        sourceId: skill.id,
        actorType: 'player',
        kind: String(might.boon).toLowerCase(),
        stacks: Number(might.stacks),
        duration: Number(might.duration),
        skillName: 'Fervent Stance'
      });
    }
  }
}

// Purblinding Plasma recharges faster while an Air bullet is loaded, and Flow
// State shortens the recharge of dual (slot 3) skills.
function modifyRechargeDuration(context: ElementalistRuntime, skill: Skill, duration: number): number {
  let adjusted = duration;
  if (skill.id === ID.PURBLINDING_PLASMA && professionCoreState(context).pistolBullets.Air) {
    const purblindingPlasmaProfile = requireBalanceProfileFromContext(context, PROFILE.purblindingPlasma);
    adjusted *= balanceProfileNumber(purblindingPlasmaProfile, 'rechargeMultiplier');
  }

  if (String(skill.slot) === 'Weapon_3' && weaverDualAttunements(skill) && hasTrait(context, 'Flow State')) {
    const flowStateProfile = requireBalanceProfileFromContext(context, PROFILE.flowState);
    adjusted *= balanceProfileNumber(flowStateProfile, 'rechargeMultiplier');
  }

  return adjusted;
}

/** Native tasks own Weave Self and stance pulses; actual controls and swaps own their trait reactions. */
export const weaverHooks: Partial<RuntimeProfession<ElementalistRuntimeState>> = {
  initialize,
  availability,
  rechargeWork: modifyRechargeDuration,
  rechargeStart: modifyWeaveSelfRechargeStart,
  prepareEvent(runtime, event) {
    const skill = runtime.helpers.skillsById.get(event.skillId ?? event.sourceId);
    // Dual orbs retain their cast owner until contact so Grand Finale cancels both hands together.
    if (
      skill &&
      skillWeapon(skill) === 'Hammer' &&
      weaverDualAttunements(skill) &&
      (event.type === 'damage' || event.type === 'condition') &&
      canonicalTime(event.at) > runtime.time
    ) {
      runtime.schedule('elementalist.packet', event.at, event, { id: String(event.activationId), generation: 0 });
      return null;
    }

    return event;
  },
  onCastStart(runtime, cast) {
    startWeaveSelfCast(runtime, cast, cast.skill);
    if (
      PRIMORDIAL_STANCES.has(Number(cast.skill.id)) &&
      !cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)
    )
      schedulePrimordialStance(runtime, cast, cast.skill);
  },
  modifyEffects(_runtime, cast, effects) {
    return PRIMORDIAL_STANCES.has(Number(cast.skill.id)) ? [] : effects;
  },
  onCastComplete(runtime, cast) {
    if (!cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd))
      withElementalistCast(runtime, cast, () => onCastComplete(runtime, cast, cast.skill));
  },

  reactions: { 'control.resolved': onAcceptedEvent },
  tasks: {
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
/** Attribute and damage contributions read the same live specialization state. */
export const weaverAttributeRules = { modifyAttributes: modifyWeaverAttributes, modifierRules: weaverModifierRules };
