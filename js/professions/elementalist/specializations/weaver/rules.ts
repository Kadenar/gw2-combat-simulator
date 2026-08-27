import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '../../../../platform/gw2/scheduler/skill-events.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import type {
  AvailabilityResult,
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  Skill
} from '../../../../platform/engine/types.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import type { ElementalistCastContext, ElementalistPrecastContext, ElementalistSchedulerContext } from '../../types.js';
import { modifyWeaverAttributes, weaverModifierRules } from './modifiers.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { grantEndurance } from '../../../../platform/gw2/combat/resources/endurance.js';
import { elementalistAlacrityAdjustedDuration, triggerBountifulPower } from '../../core/rules.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '../../core/state.js';
import { weaverState } from './state.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue,
  elementalistEffectValue
} from '../../core/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { applyWeaverPistolState } from './pistol.js';
import { elementalistEventSkill, emitProfiledBuff, emitProfiledCondition, skillWeapon } from '../../core/mechanics.js';
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  targetAttunement
} from '../../core/attunements.js';
import { applyWeaverHammerState, weaverHammerAvailability } from './hammer.js';
import { weaverDualAttunements } from './skills.js';

const WEAVE_SELF_ACTIVATION_TASK = 'elementalist.weave-self-activation';
const WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS = 4;

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
      duration: elementalistBalanceValue(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
      skillName: 'Starting Attunement'
    });
  }
}

// Enforce Weaver's dual-hand attunement model, Unravel replacement state, and
// specialization-only skill gates before Core evaluates ordinary weapon rules.
function availability(context: ElementalistPrecastContext, skill: Skill): AvailabilityResult {
  if (skill.name === 'Unravel' && !hasTrait(context, 'Elements of Rage')) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.weaver-elements-of-rage',
      reason: `${skill.name} is unavailable — requires Elements of Rage.`
    };
  }

  const hammerAvailability = weaverHammerAvailability(context, skill);
  if (hammerAvailability) return hammerAvailability as AvailabilityResult;

  const chainPosition = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (skill.type === 'Weapon' && skill.attunement && !chainPosition) {
    const core = professionCoreState(context);
    const state = weaverState.from(context);
    const attunement = String(skill.attunement);
    const dualAttunements = weaverDualAttunements(skill);
    const required = dualAttunements || [attunement];
    const secondary = state.secondaryAttunement || core.primaryAttunement;
    const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
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

  if (skill.name !== 'Tailored Victory') return { ready: true };
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

  if (
    event.type !== 'elementalist.attunement' ||
    event.skillName === 'Unravel' ||
    !isElementalistAttunement(event.to) ||
    !isElementalistAttunement(event.from)
  ) {
    return;
  }

  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = event.at;
  const target = event.to;
  const previous = event.from;
  const sourceId = event.skillId ?? event.sourceId;
  const source = String(event.skillName || event.source || 'Attunement');
  const unravelActive = state.unravelUntil > at;
  const weaveSelfActive = state.weaveSelfUntil > at;

  if (unravelActive) {
    state.secondaryAttunement = target;
    context.replaceEvent(event, { secondaryAttunement: target });
  }

  if (weaveSelfActive) {
    const recharge = elementalistAlacrityAdjustedDuration(
      context as never,
      elementalistBalanceValue(context, PROFILE.resources, 'initialDelay', 2)
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at + recharge);
    }
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
      duration: elementalistBalanceValue(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
      skillName: source
    });
  }

  if (weaveSelfActive) {
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

    if (visited.size >= ELEMENTALIST_ATTUNEMENTS.length) {
      state.weaveSelfUntil = 0;
      state.weaveSelfVisited = [];
      const perfectWeaveDuration = elementalistBalanceValue(context, PROFILE.resources, 'recharge', 10);
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
  }

  if (at < Number(context.combatStartTime || 0) - context.epsilon) return;
  if (hasTrait(context, "Weaver's Prowess") && (unravelActive || target === previous)) {
    const resistance = elementalistBalanceEffect(context, PROFILE.weaversProwess, 'boon', 'Resistance');
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

  triggerBountifulPower(context as never, at, unravelActive ? 1 : 2, sourceId);
}

function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  if (skill.name !== 'Weave Self') return;
  const at =
    context.start +
    (context.fullEnd - context.start) * elementalistBalanceValue(context, PROFILE.resources, 'firstPacketRatio', 0.65);
  if (at > context.effectiveEnd + context.epsilon) return;
  context.tasks.schedule({
    type: WEAVE_SELF_ACTIVATION_TASK,
    at,
    ownerId: context.reservationId,
    payload: { sourceId: skill.id }
  });
}

function modifyRechargeStart(context: ElementalistPrecastContext, rechargeStart: number): number {
  if (context.skill.name !== 'Weave Self') return rechargeStart;
  return (
    context.start +
    (rechargeStart - context.start) * elementalistBalanceValue(context, PROFILE.resources, 'firstPacketRatio', 0.65)
  );
}

// Commit dual-attunement transitions and stance progress at effectiveEnd, then
// mark the transition handled so Core does not apply a second attunement swap.
function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = context.effectiveEnd;
  const dualAttunements = weaverDualAttunements(skill);
  const target = targetAttunement(skill);
  if (target) {
    const previous = core.primaryAttunement;
    state.secondaryAttunement = state.unravelUntil > at ? target : previous;
    const baseRecharge = Math.max(
      0,
      WEAVER_DUAL_ATTUNEMENT_RECHARGE_SECONDS -
        (hasTrait(context, 'Flow State')
          ? elementalistBalanceValue(context, PROFILE.flowState, 'rechargeReduction', 1)
          : 0)
    );
    onAttunementComplete(context, skill, target, {
      secondaryAttunement: state.secondaryAttunement,
      rechargeDuration: elementalistAttunementRechargeDuration(context, baseRecharge)
    });
    (context as unknown as SchedulerRecord).elementalistAttunementHandled = true;
  }

  applyWeaverPistolState(context, skill);
  applyWeaverHammerState(context, skill);

  if (hasTrait(context, 'Bolstered Elements') && skill.skillFamily === 'Stance') {
    emitProfiledBuff(context, at, PROFILE.bolsteredElements, 'Protection', 'Protection', 1, 3, skill.name, skill.id);
  }

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
            elementalistBalanceValue(context, PROFILE.swiftRevenge, 'resourceGain', 25),
            at,
            elementalistBalanceValue(context, CORE_PROFILE.resources, 'maximumStacks', 100)
          )
        );
      }
    }
  }

  if (
    hasTrait(context, 'Superior Elements') &&
    dualAttunements &&
    isInternalCooldownReady(at, state.superiorElementsReadyAt)
  ) {
    state.superiorElementsReadyAt =
      at + elementalistBalanceValue(context, PROFILE.superiorElements, 'internalCooldown', 4);
    emitProfiledCondition(context, at, PROFILE.superiorElements, 'Weakness', 'Weakness', 1, 5, skill.name, skill.id);
  }

  if (
    skillWeapon(skill) === 'Spear' &&
    String(skill.slot || '') === 'Weapon_3' &&
    dualAttunements &&
    core.primaryAttunement !== state.secondaryAttunement
  ) {
    setElementalistAttunementReadyAt(context, core.primaryAttunement, at);
  }

  if (skill.name === 'Unravel') {
    const previousPrimary = core.primaryAttunement;
    const previousSecondary = state.secondaryAttunement;
    state.secondaryAttunement = core.primaryAttunement;
    state.unravelUntil = at + elementalistBalanceValue(context, PROFILE.unravel, 'durationMultiplier', 5);
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
    const profiledBoon = elementalistBalanceEffect(context, PROFILE.unravel, 'boon', boon[0]);
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
        duration: elementalistBalanceValue(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
        stacks: 1
      });
    }
  }

  if (dualAttunements && state.ferventStanceUntil >= at) {
    const might = elementalistBalanceEffect(context, PROFILE.ferventStance, 'boon', 'Might');
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
      at + elementalistBalanceValue(context, PROFILE.ferventStance, 'durationMultiplier', 8);
  }
});

function handleWeaveSelfActivation(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const state = weaverState.from(context);
  const core = professionCoreState(context);
  const at = task.at;
  const sourceId = String(task.payload?.sourceId || 'weave-self');
  const duration = elementalistBalanceValue(context, PROFILE.resources, 'durationMultiplier', 20);
  state.weaveSelfUntil = at + duration;
  state.weaveSelfVisited = [core.primaryAttunement];
  state.perfectWeaveUntil = 0;
  if (core.primaryAttunement === 'Fire') {
    emitSkillBuff(context, elementalistEventSkill(context, 'Weave Self', sourceId), {
      at,
      source: 'Weave Self',
      sourceId,
      actorType: 'player',
      kind: 'weave self fire',
      stacks: 1,
      duration,
      skillName: 'Weave Self'
    });
  } else if (core.primaryAttunement === 'Air') {
    emitSkillBuff(context, elementalistEventSkill(context, 'Weave Self', sourceId), {
      at,
      source: 'Weave Self',
      sourceId,
      actorType: 'player',
      kind: 'weave self air',
      stacks: 1,
      duration,
      skillName: 'Weave Self'
    });
  }
}

// Commit Weaver utility windows and schedule stance effects only after the
// triggering cast reaches its required completion point.
function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (skill.name === 'Unravel') {
    const state = weaverState.from(context);
    const core = professionCoreState(context);
    state.unravelUntil =
      context.effectiveEnd + elementalistBalanceValue(context, PROFILE.unravel, 'durationMultiplier', 5);
    for (const attunement of Object.keys(core.attunementReadyAt)) {
      setElementalistAttunementReadyAt(
        context,
        attunement as keyof typeof core.attunementReadyAt,
        context.effectiveEnd
      );
    }

    return;
  }

  if (!skill.name.startsWith('Primordial Stance')) return;
  const tickTimes = new Set<number>();
  for (const event of context.events) {
    if (event.activationId !== context.reservationId) continue;
    if (event.type === 'condition') {
      if (event.at > context.effectiveEnd + context.epsilon) {
        tickTimes.add(event.at);
      }

      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'replaced by dynamic Primordial Stance attunements'
      });
    } else if (event.type === 'damage') {
      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'replaced by chronological Primordial Stance pulses'
      });
    }
  }

  for (const at of tickTimes) {
    context.tasks.schedule({
      type: 'elementalist.primordial-stance',
      at,
      ownerId: context.reservationId,
      payload: { sourceId: skill.id }
    });
  }
}

// Resolve one Primordial Stance pulse from the attunement snapshot carried by
// the task, then emit the matching dual-element conditions.
function handlePrimordialStanceTick(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  const sourceId = (task.payload?.sourceId || 'primordial-stance') as Skill['id'];
  const attunements = state.secondaryAttunement
    ? [core.primaryAttunement, state.secondaryAttunement]
    : [core.primaryAttunement];
  const effects: Readonly<Record<string, readonly [string, number, number]>> = {
    Fire: ['Burning', 1, 2],
    Water: ['Chilled', 1, 1],
    Air: ['Vulnerability', 8, 3],
    Earth: ['Bleeding', 2, 6]
  };
  emitSkillDamage(context, {
    at: task.at,
    source: 'elementalist',
    sourceId,
    actorType: 'player',
    skillName: 'Primordial Stance',
    skillId: sourceId,
    coefficient: elementalistEffectValue(context, PROFILE.primordialStance, 'strike', 'coefficient', 0.33),
    skillWeapon: 'Unequipped',
    damageKind: 'field-tick'
  });
  for (const attunement of attunements) {
    const [condition, stacks, duration] = effects[attunement];
    const effect = elementalistBalanceEffect(context, PROFILE.primordialStance, 'condition', attunement);
    emitSkillCondition(context, {
      at: task.at,
      source: 'Primordial Stance',
      sourceId,
      actorType: 'player',
      skillName: 'Primordial Stance',
      condition: String(effect?.condition || condition),
      stacks: Number(effect?.stacks ?? stacks),
      duration: Number(effect?.duration ?? duration)
    });
  }
}

function modifyRechargeDuration(context: ElementalistPrecastContext, duration: number): number {
  const skill = context.skill;
  let adjusted = duration;
  if (skill.name === 'Purblinding Plasma' && professionCoreState(context).pistolBullets.Air) {
    adjusted *= elementalistBalanceValue(context, PROFILE.purblindingPlasma, 'rechargeMultiplier', 2 / 3);
  }

  if (String(skill.slot) === 'Weapon_3' && weaverDualAttunements(skill) && hasTrait(context, 'Flow State')) {
    adjusted *= elementalistBalanceValue(context, PROFILE.flowState, 'rechargeMultiplier', 0.8);
  }

  return adjusted;
}

export const weaverCastRules = Object.freeze({
  availability: {
    id: 'elementalist.weaver-availability',
    order: 30,
    handler: availability
  },
  modifyRechargeStart,
  modifyRechargeDuration
});

export const weaverAttributeRules = Object.freeze({
  modifyAttributes: modifyWeaverAttributes,
  modifierRules: weaverModifierRules
});

export const weaverSchedulerHooks = Object.freeze({
  initialize: {
    id: 'elementalist.weaver-initialize',
    order: 30,
    handler: initialize
  },
  onCastStart: {
    id: 'elementalist.weaver-cast-start',
    order: 30,
    handler: onCastStart
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
