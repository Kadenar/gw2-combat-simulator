import type {
  AvailabilityResult,
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  Skill
} from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistPrecastContext, ElementalistSchedulerContext } from '../../types.js';
import { modifyWeaverAttributes, weaverModifierRules } from './modifiers.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { elementalistAlacrityAdjustedDuration, emitElementalistBuff, triggerBountifulPower } from '../../core/rules.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  elementalistCoreState,
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
import { emitProfiledBuff, emitProfiledCondition, skillWeapon } from '../../core/mechanics.js';
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
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const state = weaverState.from(context);
  state.secondaryAttunement = isElementalistAttunement(context.config.secondaryAttunement)
    ? context.config.secondaryAttunement
    : core.primaryAttunement;
  if (core.primaryAttunement === state.secondaryAttunement && hasTrait(context as never, 'Elements of Rage')) {
    emitElementalistBuff(
      context as never,
      context.state.time,
      'Elements of Rage',
      1,
      elementalistBalanceValue(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
      'Starting Attunement',
      'starting-attunement'
    );
  }
}

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
    const core = elementalistCoreState(context as unknown as SchedulerRecord);
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
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
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
    emitElementalistBuff(
      context as never,
      at,
      'Elements of Rage',
      1,
      elementalistBalanceValue(context, PROFILE.elementsOfRage, 'durationMultiplier', 8),
      source,
      sourceId
    );
  }

  if (weaveSelfActive) {
    const visited = new Set(state.weaveSelfVisited);
    visited.add(target);
    state.weaveSelfVisited = [...visited];
    const remaining = Math.max(0, state.weaveSelfUntil - at);
    if (target === 'Fire' || target === 'Air') {
      emitElementalistBuff(context as never, at, `Weave Self ${target}`, 1, remaining, source, sourceId);
    }

    if (visited.size >= ELEMENTALIST_ATTUNEMENTS.length) {
      state.weaveSelfUntil = 0;
      state.weaveSelfVisited = [];
      const perfectWeaveDuration = elementalistBalanceValue(context, PROFILE.resources, 'recharge', 10);
      state.perfectWeaveUntil = at + perfectWeaveDuration;
      emitElementalistBuff(context as never, at, 'Perfect Weave', 1, perfectWeaveDuration, source, sourceId);
      emitElementalistBuff(context as never, at, 'Weave Self Fire', 1, perfectWeaveDuration, source, sourceId);
      emitElementalistBuff(context as never, at, 'Weave Self Air', 1, perfectWeaveDuration, source, sourceId);
    }
  }

  if (at < Number(context.combatStartTime || 0) - context.epsilon) return;
  if (hasTrait(context, "Weaver's Prowess") && (unravelActive || target === previous)) {
    const resistance = elementalistBalanceEffect(context, PROFILE.weaversProwess, 'boon', 'Resistance');
    emitElementalistBuff(
      context as never,
      at,
      String(resistance?.boon || 'Resistance'),
      Number(resistance?.stacks ?? 1),
      Number(resistance?.duration ?? 3),
      "Weaver's Prowess",
      sourceId
    );
  }

  triggerBountifulPower(context as never, at, unravelActive ? 1 : 2, sourceId);
}

function emitBuff(
  context: ElementalistCastContext,
  skill: Skill,
  kind: string,
  stacks: number,
  duration: number
): void {
  emitElementalistBuff(context as never, context.effectiveEnd, kind, stacks, duration, skill.name, skill.id);
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

function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  const state = weaverState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
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
        core.endurance = Math.min(
          elementalistBalanceValue(context, CORE_PROFILE.resources, 'maximumStacks', 100),
          core.endurance + elementalistBalanceValue(context, PROFILE.swiftRevenge, 'resourceGain', 25)
        );
      }
    }
  }

  if (
    hasTrait(context, 'Superior Elements') &&
    dualAttunements &&
    state.superiorElementsReadyAt <= at + context.epsilon
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
    emitBuff(
      context,
      skill,
      String(profiledBoon?.boon || boon[1]),
      Number(profiledBoon?.stacks ?? boon[2]),
      Number(profiledBoon?.duration ?? 5)
    );
    if (hasTrait(context, 'Elements of Rage') && previousPrimary !== previousSecondary) {
      emitBuff(
        context,
        skill,
        'Elements of Rage',
        1,
        elementalistBalanceValue(context, PROFILE.elementsOfRage, 'durationMultiplier', 8)
      );
    }
  }

  if (dualAttunements && state.ferventStanceUntil >= at) {
    const might = elementalistBalanceEffect(context, PROFILE.ferventStance, 'boon', 'Might');
    emitElementalistBuff(
      context as never,
      at,
      String(might?.boon || 'Might'),
      Number(might?.stacks ?? 3),
      Number(might?.duration ?? 8),
      'Fervent Stance',
      skill.id
    );
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
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = task.at;
  const sourceId = String(task.payload?.sourceId || 'weave-self');
  const duration = elementalistBalanceValue(context, PROFILE.resources, 'durationMultiplier', 20);
  state.weaveSelfUntil = at + duration;
  state.weaveSelfVisited = [core.primaryAttunement];
  state.perfectWeaveUntil = 0;
  if (core.primaryAttunement === 'Fire') {
    emitElementalistBuff(context as never, at, 'Weave Self Fire', 1, duration, 'Weave Self', sourceId);
  } else if (core.primaryAttunement === 'Air') {
    emitElementalistBuff(context as never, at, 'Weave Self Air', 1, duration, 'Weave Self', sourceId);
  }
}

function afterCast(context: ElementalistCastContext, skill: Skill): void {
  if (skill.name === 'Unravel') {
    const state = weaverState.from(context);
    const core = elementalistCoreState(context as unknown as SchedulerRecord);
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

function handlePrimordialStanceTick(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
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
  context.emit({
    type: 'damage',
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
    context.emit({
      type: 'condition',
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
  if (skill.name === 'Purblinding Plasma' && elementalistCoreState(context).pistolBullets.Air) {
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
