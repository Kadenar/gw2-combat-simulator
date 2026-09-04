/**
 * Weaver's dual-attunement mechanic.
 *
 * The Elementalist core owns the main-hand (primary) attunement; this module
 * owns the off-hand element and everything that follows from the pair: the
 * slot-based cast gates, the shared attunement recharge an attunement cast
 * imposes, the Unravel / Weave Self / Perfect Weave windows, Primordial Stance
 * pulses, and the traits that react to swaps and dual-skill completions.
 */
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import type { AvailabilityResult, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import {
  modifyWeaverAttributes,
  weaverModifierRules
} from '#gw2/professions/elementalist/specializations/weaver/traits/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { triggerBountifulPower } from '#gw2/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  isElementalistAttunement,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
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
  handlePrimordialStanceTick,
  schedulePrimordialStance
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';

const WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;

// Seed the off-hand element from the build (falling back to the starting
// attunement) and, when both hands open on the same element, carry Elements of
// Rage into the opener the way a real fully-attuned swap would.
function initialize(context: ElementalistSchedulerContext): void {
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  state.secondaryAttunement = isElementalistAttunement(context.config.secondaryAttunement)
    ? context.config.secondaryAttunement
    : core.primaryAttunement;
  if (core.primaryAttunement === state.secondaryAttunement && hasTrait(context, 'Elements of Rage')) {
    emitSkillBuff(context, elementalistEventSkill(context, 'Starting Attunement', 'starting-attunement'), {
      at: context.state.time,
      source: 'Starting Attunement',
      sourceId: 'starting-attunement',
      actorType: 'player',
      kind: 'elements of rage',
      stacks: 1,
      duration: balanceProfileValueFromContext(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
      skillName: 'Starting Attunement'
    });
  }
}

// Enforce Weaver's dual-hand attunement model, Unravel replacement state, and
// specialization-only skill gates before Core evaluates ordinary weapon rules.
function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
  if (skill.id === ID.UNRAVEL && !hasTrait(context, 'Elements of Rage')) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.weaver-elements-of-rage',
      reason: `${skill.name} is unavailable — requires Elements of Rage.`
    };
  }

  const hammerAvailability = weaverHammerAvailability(context, skill);
  if (hammerAvailability) return hammerAvailability as AvailabilityResult;

  // Autoattack chain links stay castable on their own chain state, so only
  // chain roots and non-chain weapon skills are matched against the hands.
  const chainPosition = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (skill.type === 'Weapon' && skill.attunement && !chainPosition) {
    const core = professionCoreState(context);
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
    const unravelActive = weaverState.from(context).unravelUntil > context.start;
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
      return {
        ready: false,
        retryAt: null,
        code: unravelActive ? 'elementalist.unravel-attunement' : 'elementalist.weaver-attunement',
        reason: unravelActive
          ? `${skill.name} is unavailable - requires ${core.primaryAttunement} while Unravel is active.`
          : `${skill.name} is unavailable - requires ${attunement} in the matching Weaver hand.`
      };
    }
  }

  // Tailored Victory is the Weave Self flipover and only exists while Perfect
  // Weave is up.
  if (skill.id !== ID.TAILORED_VICTORY) return { ready: true };
  const state = weaverState.from(context);
  return state.perfectWeaveUntil > context.start + context.epsilon
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: 'elementalist.weaver-perfect-weave',
        reason: `${skill.name} is unavailable — requires Perfect Weave.`
      };
}

// React to scheduled events: Elemental Pursuit on player control effects, and
// on every attunement swap keep the hands in sync, advance Weave Self, and fire
// the swap-triggered Weaver traits.
function onEventScheduled(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  if (event.type === 'control' && event.actorType === 'player' && hasTrait(context, 'Elemental Pursuit')) {
    emitProfiledBuff(
      context as never,
      event.at,
      PROFILE.elementalPursuit,
      'Swiftness',
      'Swiftness',
      1,
      3,
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
    context.replaceEvent(event, { secondaryAttunement: target });
  }

  // Fully attuned setup swaps can carry Elements of Rage into the opener.
  if ((target === previous || unravelActive) && hasTrait(context, 'Elements of Rage')) {
    emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
      at,
      source,
      sourceId,
      actorType: 'player',
      kind: 'elements of rage',
      stacks: 1,
      duration: balanceProfileValueFromContext(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
      skillName: source
    });
  }

  applyWeaveSelfAttunement(context, at, target, source, sourceId);

  // Pre-combat setup swaps must not generate trait procs.
  if (at < Number(context.combatStartTime || 0) - context.epsilon) return;
  if (hasTrait(context, "Weaver's Prowess") && (unravelActive || target === previous)) {
    const resistance = balanceProfileEffectFromContext(context, PROFILE.weaversProwess, 'boon', 0, 'Resistance');
    emitSkillBuff(context, elementalistEventSkill(context, "Weaver's Prowess", sourceId), {
      at,
      source: "Weaver's Prowess",
      sourceId,
      actorType: 'player',
      kind: String(resistance?.boon || 'Resistance').toLowerCase(),
      stacks: Number(resistance?.stacks ?? 1),
      duration: Number(resistance?.duration ?? 3),
      skillName: "Weaver's Prowess"
    });
  }

  // A normal Weaver swap moves both hands and so counts as two attunement
  // changes; under Unravel the hands move together and it counts as one.
  triggerBountifulPower(context as never, at, unravelActive ? 1 : 2, sourceId);
}

// Commit dual-attunement transitions and stance progress at effectiveEnd, then
// mark the transition handled so Core does not apply a second attunement swap.
function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = context.effectiveEnd;
  const dualAttunements = weaverDualAttunements(skill);
  // An attunement cast pushes the old main-hand element into the off hand
  // (under Unravel both hands land on the target instead) and puts all four
  // attunements on one shared dual recharge, shortened by Flow State and then by
  // the usual Core recharge adjustments.
  const target = targetAttunement(skill);
  if (target) {
    const previous = core.primaryAttunement;
    state.secondaryAttunement = state.unravelUntil > at ? target : previous;
    const baseRecharge = Math.max(
      0,
      WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS -
        (hasTrait(context, 'Flow State')
          ? balanceProfileValueFromContext(context, PROFILE.flowState, 'rechargeReduction', 1)
          : 0)
    );
    onAttunementComplete(context, skill, target, {
      secondaryAttunement: state.secondaryAttunement,
      rechargeDuration: elementalistAttunementRechargeDuration(context, baseRecharge)
    });
    // Claim the transition so Core does not also run its single-attunement swap.
    (context as unknown as SchedulerRecord).elementalistAttunementHandled = true;
  }

  applyWeaverPistolState(context, skill);
  applyWeaverHammerState(context, skill);

  if (hasTrait(context, 'Bolstered Elements') && skill.skillFamily === 'Stance') {
    emitProfiledBuff(context, at, PROFILE.bolsteredElements, 'Protection', 'Protection', 1, 3, skill.name, skill.id);
  }

  // Swift Revenge pays out per element of the dual skill that was just cast.
  if (hasTrait(context, 'Swift Revenge') && dualAttunements) {
    for (const element of dualAttunements) {
      if (element === 'Fire') {
        emitProfiledBuff(context, at, PROFILE.swiftRevenge, 'Fire', 'Might', 3, 5, skill.name, skill.id);
      } else if (element === 'Air') {
        emitProfiledBuff(context, at, PROFILE.swiftRevenge, 'Air', 'Swiftness', 1, 5, skill.name, skill.id);
      } else if (element === 'Earth') {
        Object.assign(
          core,
          grantEndurance(
            core,
            balanceProfileValueFromContext(context, PROFILE.swiftRevenge, 'resourceGain', 25),
            at,
            balanceProfileValueFromContext(context, CORE_PROFILE.resources, 'maximumStacks', 100)
          )
        );
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
    state.superiorElementsReadyAt =
      at + balanceProfileValueFromContext(context, PROFILE.superiorElements, 'internalCooldown', 4);
    emitProfiledCondition(context, at, PROFILE.superiorElements, 'Weakness', 'Weakness', 1, 5, skill.name, skill.id);
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
    state.unravelUntil = at + balanceProfileValueFromContext(context, PROFILE.unravel, 'durationMultiplier', 5);
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
    for (const attunement of Object.keys(core.attunementReadyAt)) {
      setElementalistAttunementReadyAt(context, attunement as keyof typeof core.attunementReadyAt, at);
    }

    const boon =
      previousPrimary === 'Fire'
        ? (['Fire', 'Might', 5] as const)
        : previousPrimary === 'Water'
          ? (['Water', 'Vigor', 1] as const)
          : previousPrimary === 'Air'
            ? (['Air', 'Fury', 1] as const)
            : (['Earth', 'Protection', 1] as const);
    const profiledBoon = balanceProfileEffectFromContext(context, PROFILE.unravel, 'boon', 0, boon[0]);
    const boonKind = String(profiledBoon?.boon || boon[1]).toLowerCase();
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      name: skill.name,
      kind: boonKind,
      duration: Number(profiledBoon?.duration ?? 5),
      stacks: Number(profiledBoon?.stacks ?? boon[2])
    });
    if (hasTrait(context, 'Elements of Rage') && previousPrimary !== previousSecondary) {
      emitSkillBuff(context, skill, {
        at: context.effectiveEnd,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        name: skill.name,
        kind: 'elements of rage',
        duration: balanceProfileValueFromContext(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
        stacks: 1
      });
    }
  }

  // Fervent Stance grants might on the next dual attack inside its window.
  if (dualAttunements && state.ferventStanceUntil >= at) {
    const might = balanceProfileEffectFromContext(context, PROFILE.ferventStance, 'boon', 0, 'Might');
    emitSkillBuff(context, skill, {
      at,
      source: 'Fervent Stance',
      sourceId: skill.id,
      actorType: 'player',
      kind: String(might?.boon || 'Might').toLowerCase(),
      stacks: Number(might?.stacks ?? 3),
      duration: Number(might?.duration ?? 8),
      skillName: 'Fervent Stance'
    });
  }
}

/** Runs Weaver mechanics owned by one completed skill activation. */
export const weaverSkillMechanicHandlers = Object.freeze({
  'elementalist.weaver.consume-perfect-weave': ({ context }: { context: ElementalistSchedulerContext }): void => {
    weaverState.from(context).perfectWeaveUntil = 0;
  },
  'elementalist.weaver.arm-fervent-stance': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    weaverState.from(context).ferventStanceUntil =
      at + balanceProfileValueFromContext(context, PROFILE.ferventStance, 'durationMultiplier', 8);
  }
});

// Commit Weaver utility windows and schedule stance effects only after the
// triggering cast reaches its required completion point.
function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (skill.id === ID.UNRAVEL) {
    const state = weaverState.from(context);
    const core = professionCoreState(context);
    state.unravelUntil =
      context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.unravel, 'durationMultiplier', 5);
    for (const attunement of Object.keys(core.attunementReadyAt)) {
      setElementalistAttunementReadyAt(
        context,
        attunement as keyof typeof core.attunementReadyAt,
        context.effectiveEnd
      );
    }

    return;
  }

  schedulePrimordialStance(context, skill);
}

// Purblinding Plasma recharges faster while an Air bullet is loaded, and Flow
// State shortens the recharge of dual (slot 3) skills.
function modifyRechargeDuration(context: ElementalistPrecastContext, duration: number): number {
  const skill = context.skill;
  let adjusted = duration;
  if (skill.id === ID.PURBLINDING_PLASMA && professionCoreState(context).pistolBullets.Air) {
    adjusted *= balanceProfileValueFromContext(context, PROFILE.purblindingPlasma, 'rechargeMultiplier', 2 / 3);
  }

  if (String(skill.slot) === 'Weapon_3' && weaverDualAttunements(skill) && hasTrait(context, 'Flow State')) {
    adjusted *= balanceProfileValueFromContext(context, PROFILE.flowState, 'rechargeMultiplier', 0.8);
  }

  return adjusted;
}

/** Cast-time contributions: the Weaver availability gate and its recharge adjustments. */
export const weaverCastRules = Object.freeze({
  availability: {
    id: 'elementalist.weaver-availability',
    order: 30,
    handler: availability
  },
  modifyRechargeStart: modifyWeaveSelfRechargeStart,
  modifyRechargeDuration
});

/** Attribute and damage-modifier contributions owned by Weaver traits. */
export const weaverAttributeRules = Object.freeze({
  modifyAttributes: modifyWeaverAttributes,
  modifierRules: weaverModifierRules
});

/**
 * Scheduler lifecycle bindings for the mechanic, plus the task handlers for the
 * deferred Weave Self activation and the rescheduled Primordial Stance pulses.
 */
export const weaverSchedulerHooks = Object.freeze({
  initialize: {
    id: 'elementalist.weaver-initialize',
    order: 30,
    handler: initialize
  },
  onCastStart: {
    id: 'elementalist.weaver-cast-start',
    order: 30,
    handler: startWeaveSelfCast
  },
  afterCast: {
    id: 'elementalist.weaver-after-cast',
    order: 30,
    handler: afterCast
  },
  onCastComplete: {
    id: 'elementalist.weaver-complete',
    order: 5,
    handler: onCastComplete
  },
  onEventScheduled: {
    id: 'elementalist.weaver-attunement',
    order: 30,
    handler: onEventScheduled
  },
  taskHandlers: Object.freeze({
    [WEAVE_SELF_ACTIVATION_TASK]: handleWeaveSelfActivation,
    'elementalist.primordial-stance': handlePrimordialStanceTick
  })
});
