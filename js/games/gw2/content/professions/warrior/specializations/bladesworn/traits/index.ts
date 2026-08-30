import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import {
  DRAGON_CHARGE_INTERVAL_SECONDS,
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  DRAGON_TRIGGER_DURATION_SECONDS,
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent,
  dragonSlashCoefficient,
  dragonFlowPerInterval,
  maximumDragonCharges,
  projectDragonCharges,
  projectDragonFlow,
  requestedDragonCharges,
  type DragonFlowRateSegment
} from '#gw2/content/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chains.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import {
  applyWarriorBurstSpendTraits,
  grantBerserkersPower
} from '#gw2/content/professions/warrior/core/traits/index.js';
import { warriorBalanceProfile, warriorBalanceProfileEffect } from '#gw2/content/professions/warrior/core/profiles.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/content/professions/warrior/specializations/bladesworn/state.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';

const UNSEEN_SWORD_STRIKE_ID = 62847;

function emitGunsaberSwapTrait(context: WarriorCastContext, at: number): void {
  // Skip trait procs that would fire before combat begins when an explicit
  // combat start is configured (pre-cast weapon swaps should not trigger it).
  if (
    context.hasExplicitCombatStart &&
    (context.combatStartTime == null || at + context.epsilon < context.combatStartTime)
  ) {
    return;
  }

  const state = bladeswornState.from(context);
  if (!isInternalCooldownReady(at, state.gunsaberSwapTraitReadyAt)) return;
  let traitId = 0;
  let profile;
  if (hasTrait(context, TRAIT.UNSEEN_SWORD)) {
    traitId = TRAIT.UNSEEN_SWORD;
    profile = warriorBalanceProfile(context, PROFILE.unseenSword);
    const strike = warriorBalanceProfileEffect(profile, 'strike');
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'player',
      skillId: UNSEEN_SWORD_STRIKE_ID,
      skillName: 'Unseen Sword',
      parentSkillName: context.skill.name,
      name: 'Unseen Sword',
      coefficient: Number(strike?.coefficient ?? 1.2)
    });
  } else if (hasTrait(context, TRAIT.SHARP_AS_THE_WIND)) {
    traitId = TRAIT.SHARP_AS_THE_WIND;
    profile = warriorBalanceProfile(context, PROFILE.sharpAsTheWind);
    const burning = warriorBalanceProfileEffect(profile, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: 'Unsheathe Gunsaber',
      name: 'Sharp as the Wind — Burning',
      condition: 'Burning',
      stacks: Number(burning?.stacks ?? 1),
      duration: Number(burning?.duration ?? 3)
    });
  } else if (hasTrait(context, TRAIT.RIVERS_FLOW)) {
    traitId = TRAIT.RIVERS_FLOW;
    profile = warriorBalanceProfile(context, PROFILE.riversFlow);
    const might = warriorBalanceProfileEffect(profile, 'boon');
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: 'Unsheathe Gunsaber',
      name: "River's Flow — Might",
      kind: 'might',
      boon: 'might',
      stacks: Number(might?.stacks ?? 2),
      duration: gw2SchedulerBoonDuration(context, context.skill, 'might', Number(might?.duration ?? 8)),
      recipients: 'party'
    });
  }

  if (!traitId) return;
  state.gunsaberSwapTraitReadyAt = at + Number(profile?.internalCooldown ?? 4);
  const positiveFlow = warriorBalanceProfileEffect(profile, 'buff');
  const positiveFlowDuration = Number(positiveFlow?.duration ?? 5);
  if (state.traitPositiveFlowUntil <= at + context.epsilon) {
    state.traitPositiveFlowStartedAt = at;
  }

  state.traitPositiveFlowUntil = at + positiveFlowDuration;
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillId: ID.UNSHEATHE_GUNSABER,
    skillName: 'Unsheathe Gunsaber',
    name: 'Positive Flow',
    kind: 'positive-flow',
    stacks: Number(positiveFlow?.stacks ?? 1),
    duration: positiveFlowDuration
  });
}

function emitGunsaberWeaponSwap(context: WarriorCastContext, skill: WarriorSkill): void {
  resetAutoattackChains(context);
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }

  context.emit({
    type: 'sigil_swap',
    at: context.effectiveEnd,
    source: 'warrior',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet
  });
}

function clearDragonTriggerState(state: ReturnType<typeof bladeswornState.from>): void {
  state.dragonTriggerActive = false;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 0;
  state.nextDragonChargeAt = 0;
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = 1;
  state.dragonTriggerRotationIndex = -1;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = '';
}

export function enterGunsaber(context: WarriorCastContext, skill: WarriorSkill): void {
  bladeswornState.from(context).gunsaberActive = true;
  emitGunsaberWeaponSwap(context, skill);
  emitGunsaberSwapTrait(context, context.effectiveEnd);
}

export function exitGunsaber(context: WarriorCastContext, skill: WarriorSkill): void {
  bladeswornState.from(context).gunsaberActive = false;
  emitGunsaberWeaponSwap(context, skill);
}

export function enterDragonTrigger(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = bladeswornState.from(context);
  if (!state.gunsaberActive) enterGunsaber(context, skill);
  gainPassiveFlow(context, state.flowUpdatedAt, context.effectiveEnd);
  state.flowUpdatedAt = context.effectiveEnd;
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = context.effectiveEnd;
  const dragonTrigger = warriorBalanceProfile(context, PROFILE.dragonTrigger);
  const chargeInterval = Number(dragonTrigger?.pulseInterval ?? DRAGON_CHARGE_INTERVAL_SECONDS);
  state.dragonTriggerChargeDeadline =
    context.effectiveEnd + Number(dragonTrigger?.cooldown ?? DRAGON_TRIGGER_DURATION_SECONDS);
  state.nextDragonChargeAt = context.effectiveEnd + chargeInterval;
  state.dragonCharges = 0;
  // Tactical Reload doubles charge gain per tick. It is consumed immediately
  // so it only applies to the single Dragon Trigger entry it was active for.
  state.dragonChargesPerInterval =
    state.tacticalReloadUntil > 0 && state.tacticalReloadUntil + context.epsilon >= context.effectiveEnd ? 2 : 1;
  if (state.dragonChargesPerInterval > 1) state.tacticalReloadUntil = 0;
  state.dragonTriggerRotationIndex = context.commandIndex;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = context.reservationId;
  emitDragonTriggerEntry(context, skill);
  if (hasTrait(context, TRAIT.DRAGONSCALE_DEFENSE)) {
    const stability = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.dragonscaleDefense), 'boon');
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.DRAGONSCALE_DEFENSE,
      actorType: 'effect',
      skillId: ID.DRAGON_TRIGGER,
      skillName: 'Dragon Trigger',
      name: 'Dragonscale Defense',
      kind: 'stability',
      boon: 'stability',
      stacks: Number(stability?.stacks ?? 1),
      duration: gw2SchedulerBoonDuration(context, skill, 'stability', Number(stability?.duration ?? 3))
    });
  }
}

export function useDragonSlash(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = bladeswornState.from(context);
  const maximumCharges = maximumDragonCharges(context);
  const charges = Math.max(1, Math.min(maximumCharges, state.dragonCharges));
  const requestedCharges = requestedDragonCharges(context, maximumCharges);
  const minimum = Number(skill.dragonSlashMinimumCoefficient || 0);
  const maximum = Number(skill.dragonSlashMaximumCoefficient || minimum);
  const coefficient = dragonSlashCoefficient(minimum, maximum, charges, maximumCharges);
  // Dragon Slash Force deals damage at the midpoint of its cast; all other
  // Dragon Slash variants hit at cast end.
  const impactAt =
    skill.id === ID.DRAGON_SLASH_FORCE
      ? context.start + (context.effectiveEnd - context.start) / 2
      : context.effectiveEnd;
  const adrenalineSpent = dragonChargesToAdrenalineSpent(charges);
  applyWarriorBurstSpendTraits(context, skill, adrenalineSpent, {
    resourceSpent: state.dragonTriggerFlowSpent,
    resourceRefundRate: Number(warriorBalanceProfile(context, PROFILE.burstMastery)?.resourceGain ?? 0.2)
  });
  state.dragonAdrenalineSpentByActivation[context.reservationId] = adrenalineSpent;
  context.emit({
    type: 'resource',
    at: context.start,
    source: 'Warrior',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    sourceSkill: skill.name,
    amount: -charges,
    value: 0,
    resource: 'dragon charges',
    reason: 'profession mechanic',
    rotationIndex: context.commandIndex,
    requestedCharges,
    maximumCharges,
    chargesReached: charges,
    chargingSeconds: Math.max(0, context.start - state.dragonTriggerStartedAt),
    flowSpent: state.dragonTriggerFlowSpent,
    adrenalineBarsSpent: adrenalineSpent / 10
  });
  emitSkillDamage(context, {
    at: impactAt,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: 'Warrior',
    actorType: 'player',
    coefficient,
    skillWeapon: 'Gunsaber',
    damageKind: 'explosion',
    dragonChargesSpent: charges
  });
  if (hasTrait(context, TRAIT.UNYIELDING_DRAGON)) {
    emitSkillControl(context, {
      at: impactAt,
      skillId: skill.id,
      sourceId: TRAIT.UNYIELDING_DRAGON,
      skillName: skill.name,
      source: 'Trait',
      actorType: 'player',
      controlKind: 'stun',
      duration: 1
    });
  }

  if (hasTrait(context, TRAIT.DARING_DRAGON)) {
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.DARING_DRAGON,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Daring Dragon — Alacrity',
      kind: 'alacrity',
      boon: 'alacrity',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, skill, 'alacrity', 10),
      recipients: 'party'
    });
  }

  clearDragonTriggerState(state);
}

// Consume Artillery Slash ammo, preserve its recharge lockout, and select the
// strike profile from the number of rounds committed.
export function useArtillerySlash(context: WarriorCastContext, skill: WarriorSkill): void {
  const charges = Math.max(1, Number(context.ammo?.charges || 1));
  const state = bladeswornState.from(context);
  state.ammoRoundsSpentByActivation[context.reservationId] = charges;
  state.ammoStartedFullByActivation[context.reservationId] =
    charges >= Number(context.ammo?.maximum || skill.ammo || 0);
  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt: context.rechargeStart + Math.max(context.rechargeDuration, context.ammoLockoutDuration)
  });
  const profile = warriorBalanceProfile(context, PROFILE.artillerySlash);
  const strike = warriorBalanceProfileEffect(profile, 'strike', charges >= 2 ? 1 : 0);
  const control = warriorBalanceProfileEffect(profile, 'control');
  emitSkillDamage(context, {
    at: context.effectiveEnd,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: 'Warrior',
    actorType: 'player',
    coefficient: Number(strike?.coefficient ?? (charges >= 2 ? 3 : 2)),
    skillWeapon: 'Gunsaber',
    damageKind: 'explosion'
  });
  emitSkillControl(context, {
    at: context.effectiveEnd,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: 'Warrior',
    actorType: 'player',
    controlKind: 'daze',
    duration: Number(control?.duration ?? 1)
  });
}

// Split a time range at every Flow modifier boundary so Dragon Trigger projection
// can integrate the exact piecewise regeneration rate.
function dragonFlowRateSegments(
  context: WarriorSchedulerContext,
  from: number,
  to: number
): readonly DragonFlowRateSegment[] {
  if (!(to > from)) return [];
  const state = bladeswornState.from(context);
  const combatStart = context.hasExplicitCombatStart ? context.combatStartTime : from;
  if (combatStart == null || combatStart >= to) return [];
  const activeFrom = Math.max(from, Number(combatStart));
  const boundaries = [
    activeFrom,
    to,
    state.traitPositiveFlowStartedAt,
    state.traitPositiveFlowUntil,
    ...state.flowStabilizerWindows.flatMap((window) => [window.startedAt, window.expiresAt])
  ]
    .filter((at) => at > activeFrom && at < to)
    .concat(activeFrom, to)
    .sort((left, right) => left - right);
  const uniqueBoundaries = [...new Set(boundaries)];
  const segments: DragonFlowRateSegment[] = [];
  const resources = warriorBalanceProfile(context, PROFILE.resources);
  const baseFlow = Number(resources?.energyRegenerationPerSecond ?? 2);
  const stabilizerBonus = Number(resources?.resourceGain ?? 4);
  const positiveFlowBonus = Number(resources?.attributePerStack ?? 2);
  for (let index = 0; index < uniqueBoundaries.length - 1; index += 1) {
    const start = Number(uniqueBoundaries[index]);
    const end = Number(uniqueBoundaries[index + 1]);
    const sample = (start + end) / 2;
    const flowPerSecond =
      baseFlow +
      state.flowStabilizerWindows.reduce(
        (bonus, window) => (sample >= window.startedAt && sample < window.expiresAt ? bonus + stabilizerBonus : bonus),
        0
      ) +
      (sample >= state.traitPositiveFlowStartedAt && sample < state.traitPositiveFlowUntil ? positiveFlowBonus : 0);
    segments.push({ start, end, flowPerSecond });
  }

  return segments;
}

function dragonTriggerEntryEvent(context: WarriorSchedulerContext): WarriorSimulationEvent | undefined {
  const activationId = bladeswornState.from(context).dragonTriggerEventActivationId;
  return context.events.find(
    (event) =>
      event.type === 'resource' &&
      event.reason === DRAGON_TRIGGER_ENTRY_RESOURCE_REASON &&
      event.activationId === activationId
  ) as WarriorSimulationEvent | undefined;
}

function emitDragonTriggerEntry(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = bladeswornState.from(context);
  context.emit({
    type: 'resource',
    at: state.dragonTriggerStartedAt,
    source: 'Warrior',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    sourceSkill: skill.name,
    activationId: state.dragonTriggerEventActivationId,
    amount: 0,
    value: state.flow,
    resource: 'flow',
    reason: DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
    rotationIndex: context.commandIndex,
    maximumFlow: state.maximumFlow,
    maximumCharges: maximumDragonCharges(context),
    chargesPerInterval: state.dragonChargesPerInterval,
    flowPerInterval: dragonFlowPerInterval(context),
    nextChargeAt: state.nextDragonChargeAt,
    deadline: state.dragonTriggerChargeDeadline,
    flowRateSegments: dragonFlowRateSegments(context, state.dragonTriggerStartedAt, state.dragonTriggerChargeDeadline)
  });
}

// Detect Fury that predates the current activation so Flow Stabilizer cannot
// satisfy its own bonus through same-cast events.
function furyActiveBeforeCurrentCast(
  context: WarriorSchedulerContext,
  activationId: string,
  castStart: number
): boolean {
  const configured = context.config.boons?.fury;
  if (configured === true || Number(configured || 0) > 0) return true;
  return context.events.some(
    (event) =>
      event.type === 'buff' &&
      event.kind === 'fury' &&
      event.affectsSelf !== false &&
      event.activationId !== activationId &&
      event.at <= castStart + context.epsilon &&
      event.at + Number(event.duration || 0) > castStart + context.epsilon
  );
}

function refreshDragonTriggerEntryProjection(context: WarriorSchedulerContext): void {
  const state = bladeswornState.from(context);
  if (!state.dragonTriggerActive) return;
  const event = dragonTriggerEntryEvent(context);
  if (!event) return;
  context.replaceEvent(event, {
    flowRateSegments: dragonFlowRateSegments(context, state.dragonTriggerStartedAt, state.dragonTriggerChargeDeadline)
  });
}

function gainPassiveFlow(context: WarriorSchedulerContext, from: number, to: number): void {
  const state = bladeswornState.from(context);
  state.flow = projectDragonFlow(state.flow, state.maximumFlow, from, to, dragonFlowRateSegments(context, from, to));
}

// Advance passive Flow or project Dragon Trigger charge ticks through the target,
// emitting granted and stalled ticks before clearing an expired charge window.
export function advanceBladesworn(context: WarriorSchedulerContext, target: number): void {
  const state = bladeswornState.from(context);
  if (target <= state.flowUpdatedAt) return;
  if (!state.dragonTriggerActive) {
    gainPassiveFlow(context, state.flowUpdatedAt, target);
    state.flowUpdatedAt = target;
    return;
  }

  refreshDragonTriggerEntryProjection(context);
  const chargeThrough = Math.min(target, state.dragonTriggerChargeDeadline);
  const flowPerInterval = dragonFlowPerInterval(context);
  const chargeInterval = Number(
    warriorBalanceProfile(context, PROFILE.dragonTrigger)?.pulseInterval ?? DRAGON_CHARGE_INTERVAL_SECONDS
  );
  const ticks = projectDragonCharges({
    startTime: state.flowUpdatedAt,
    firstTickAt: state.nextDragonChargeAt,
    flow: state.flow,
    maximumFlow: state.maximumFlow,
    initialCharges: state.dragonCharges,
    maximumCharges: maximumDragonCharges(context),
    chargesPerInterval: state.dragonChargesPerInterval,
    flowPerInterval,
    intervalSeconds: chargeInterval,
    flowRateSegments: dragonFlowRateSegments(context, state.flowUpdatedAt, chargeThrough),
    deadline: chargeThrough
  });
  for (const tick of ticks) {
    const previousCharges = state.dragonCharges;
    state.flow = tick.flowAfter;
    state.dragonCharges = tick.charges;
    state.flowUpdatedAt = tick.at;
    if (tick.granted) {
      state.dragonTriggerFlowSpent += flowPerInterval;
    }

    context.emit({
      type: 'resource',
      at: tick.at,
      source: 'Warrior',
      sourceId: ID.DRAGON_TRIGGER,
      actorType: 'player',
      skillId: ID.DRAGON_TRIGGER,
      skillName: 'Dragon Trigger',
      sourceSkill: 'Dragon Trigger',
      amount: tick.charges - previousCharges,
      value: tick.charges,
      resource: 'dragon charges',
      reason: DRAGON_TRIGGER_TICK_RESOURCE_REASON,
      rotationIndex: state.dragonTriggerRotationIndex,
      flowAfter: tick.flowAfter,
      granted: tick.granted,
      deadline: state.dragonTriggerChargeDeadline
    });
    state.nextDragonChargeAt += chargeInterval;
  }

  gainPassiveFlow(context, state.flowUpdatedAt, target);
  state.flowUpdatedAt = target;
  if (target > state.dragonTriggerChargeDeadline + context.epsilon) {
    clearDragonTriggerState(state);
  }
}

function restoreAmmo(context: WarriorSchedulerContext, skill: WarriorSkill, count: number, at: number): number {
  const ammo = context.cooldownController.refreshAmmo(skill, at);
  if (!ammo) return 0;
  const restored = Math.min(Math.max(0, count), Math.max(0, ammo.maximum - ammo.charges));
  if (!restored) return 0;

  const mirroredRecharge = ammo.nextRechargeAt;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  const lastAction = [...context.events]
    .reverse()
    .find((event) => event.type === 'action' && event.skillId === skill.id);
  const lastActionEnd = Number(lastAction?.endsAt || 0);
  const lockoutReadyAt =
    lastActionEnd +
    context.rechargeDurationFor(skill, lastActionEnd, {
      ammoCastLockout: true
    });
  if (ammo.charges === 0 && mirroredRecharge != null && readyAt <= mirroredRecharge + context.epsilon) {
    context.state.cooldowns.delete(skill.id);
  }

  ammo.charges += restored;
  // Tactical Reload restores a charge without resetting count-recharge
  // progress. If the skill is temporarily full, the pending recharge can
  // still refill a charge spent before that timer completes.
  context.cooldownController.refreshAmmo(skill, at);
  if (lockoutReadyAt > at + context.epsilon) {
    context.state.cooldowns.set(skill.id, lockoutReadyAt);
  }

  return restored;
}

function reloadBladeswornAmmo(context: WarriorSchedulerContext, at: number): void {
  for (const skillId of context.state.ammo.keys()) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.specialization === 'Bladesworn') {
      restoreAmmo(context, skill, 1, at);
    }
  }
}

function activateOverchargedCartridges(context: WarriorCastContext, at: number): void {
  const state = bladeswornState.from(context);
  const active = activeCartridgeWindow(state, at);
  // Ammo is reserved before this handler runs. Casting again while the
  // cartridges are already supercharged therefore spends the charge without
  // refreshing or replacing the active window.
  if (active?.supercharged) return;
  if (active) active.expiresAt = at;
  const supercharged = Boolean(active);
  const profile = warriorBalanceProfile(context, PROFILE.overchargedCartridges);
  const buff = warriorBalanceProfileEffect(profile, 'buff', supercharged ? 1 : 0);
  const burning = warriorBalanceProfileEffect(profile, 'condition', supercharged ? 1 : 0);
  const duration = Number(buff?.duration ?? 8);
  state.overchargedCartridgeWindows.push({
    startedAt: at,
    expiresAt: at + duration,
    damageBonus: Number(buff?.damageIncreasePerStack ?? (supercharged ? 0.2 : 0.15)),
    burningDuration: Number(burning?.duration ?? (supercharged ? 5 : 3)),
    supercharged
  });
  emitSkillBuff(context, {
    at,
    source: 'Warrior',
    sourceId: ID.OVERCHARGED_CARTRIDGES,
    actorType: 'player',
    skillId: ID.OVERCHARGED_CARTRIDGES,
    skillName: 'Overcharged Cartridges',
    name: supercharged ? 'Supercharged Cartridges' : 'Overcharged Cartridges',
    kind: supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges',
    stacks: Number(buff?.stacks ?? 1),
    duration
  });
}

export function useOverchargedCartridges(context: WarriorCastContext, _skill: WarriorSkill): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  activateOverchargedCartridges(context, context.start + castDuration * (420 / 900));
}

export function trackBladeswornAmmoCast(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!(Number(skill.ammo || 0) > 0)) return;
  const state = bladeswornState.from(context);
  if (state.ammoRoundsSpentByActivation[context.reservationId] == null) {
    state.ammoRoundsSpentByActivation[context.reservationId] = 1;
  }

  if (state.ammoStartedFullByActivation[context.reservationId] == null) {
    state.ammoStartedFullByActivation[context.reservationId] = Boolean(
      context.ammo && context.ammo.charges >= context.ammo.maximum
    );
  }
}

const LUSH_FOREST_EXCLUDED_SKILL_IDS = new Set<number>([
  ID.UNSHEATHE_GUNSABER,
  ID.SHEATHE_GUNSABER,
  ID.DRAGON_TRIGGER,
  // Current live-game bug supplied with the benchmark specification.
  ID.ARTILLERY_SLASH
]);

function activeWeaponNames(context: WarriorCastContext): Set<string> {
  return new Set(
    gw2ConfiguredWeaponSet(context.config, context.state.activeWeaponSet === 2 ? 2 : 1)
      .map((weapon) => String(weapon || ''))
      .filter(Boolean)
  );
}

// Determine Lush Forest eligibility from the live Gunsaber mode, equipped weapon
// set, and selected slot skills rather than catalog ownership alone.
function skillIsOnActiveBar(context: WarriorCastContext, skill: WarriorSkill): boolean {
  const state = bladeswornState.from(context);
  if (skill.gunsaberSkill) {
    return state.gunsaberActive || state.dragonTriggerActive;
  }

  if (skill.type === 'Weapon' || skill.weapon) {
    if (state.gunsaberActive || state.dragonTriggerActive) return false;
    const weapons = activeWeaponNames(context);
    return weapons.size === 0 || weapons.has(String(skill.weapon || ''));
  }

  if (['Heal', 'Utility', 'Elite'].includes(String(skill.type || ''))) {
    const selected = selectedSkillNameSet(context.config.selectedSkills);
    return selected.size === 0 || selected.has(skill.name);
  }

  return true;
}

function activateLushForest(context: WarriorCastContext, sourceSkill: WarriorSkill, at: number): void {
  let cooldownReduction = 0;
  const rechargeReduction = Number(warriorBalanceProfile(context, PROFILE.lushForest)?.rechargeReduction ?? 0.75);
  const skillIds = new Set([...context.state.cooldowns.keys(), ...context.state.ammo.keys()]);
  for (const skillId of skillIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (!skill || LUSH_FOREST_EXCLUDED_SKILL_IDS.has(Number(skill.id)) || !skillIsOnActiveBar(context, skill)) {
      continue;
    }

    cooldownReduction += context.cooldownController.reduceSkillRecharge(skill, rechargeReduction, at);
  }

  context.emit({
    type: 'proc',
    at,
    source: 'Trait',
    sourceId: TRAIT.LUSH_FOREST,
    actorType: 'effect',
    skillId: sourceSkill.id,
    skillName: sourceSkill.name,
    name: 'Lush Forest',
    procType: 'trait',
    cooldownReduction
  });
}

// Commit Flow gains and activation-scoped ammo traits, then clear bookkeeping and
// reset Gunsaber chains that cannot continue through the completed skill.
export function completeBladeswornSkill(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = bladeswornState.from(context);
  const at = context.effectiveEnd;
  const roundsSpent = Math.max(0, Number(state.ammoRoundsSpentByActivation[context.reservationId] || 0));
  const startedFull = Boolean(state.ammoStartedFullByActivation[context.reservationId]);
  if (Number(skill.flowGain || 0) > 0) {
    state.flow = Math.min(state.maximumFlow, state.flow + Number(skill.flowGain));
  }

  if (roundsSpent > 0 && hasTrait(context, TRAIT.FIERCE_AS_FIRE)) {
    const profile = warriorBalanceProfile(context, PROFILE.fierceAsFire);
    const effect = warriorBalanceProfileEffect(profile, 'buff');
    const duration = Number(effect?.duration ?? 15);
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.filter((expiresAt) => expiresAt > at);
    state.fierceAsFireExpiries.push(...Array(roundsSpent).fill(at + duration));
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.slice(-Number(profile?.maximumStacks ?? 10));
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.FIERCE_AS_FIRE,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Fierce as Fire',
      kind: 'fierce-as-fire',
      stacks: roundsSpent,
      duration
    });
  }

  if (roundsSpent > 0 && startedFull && skill.id !== ID.ARTILLERY_SLASH && hasTrait(context, TRAIT.LUSH_FOREST)) {
    activateLushForest(context, skill, at);
  }

  const dragonAdrenalineSpent = Math.max(
    0,
    Number(state.dragonAdrenalineSpentByActivation[context.reservationId] || 0)
  );
  if (dragonAdrenalineSpent > 0) {
    const stacks = dragonAdrenalineSpent >= 30 ? 4 : dragonAdrenalineSpent >= 20 ? 3 : 2;
    grantBerserkersPower(context, stacks, at + context.epsilon, skill);
  }

  delete state.ammoRoundsSpentByActivation[context.reservationId];
  delete state.ammoStartedFullByActivation[context.reservationId];
  delete state.dragonAdrenalineSpentByActivation[context.reservationId];
  if (skill.gunsaberSkill && !context.catalog.autoattackChainPositions.has(Number(skill.id))) {
    resetAutoattackChains(context);
  }
}

/** Runs Bladesworn mechanics owned by one completed skill activation. */
export const bladeswornSkillMechanicHandlers = Object.freeze({
  'warrior.bladesworn.flow-stabilizer': ({
    context,
    at,
    castStart,
    activationId
  }: {
    context: WarriorSchedulerContext;
    at: number;
    castStart: number;
    activationId: string;
  }): void => {
    const state = bladeswornState.from(context);
    if (furyActiveBeforeCurrentCast(context, activationId, castStart)) {
      state.flow = Math.min(state.maximumFlow, state.flow + 15);
    }

    state.flowStabilizerWindows.push({ startedAt: at, expiresAt: at + 8 });
    refreshDragonTriggerEntryProjection(context);
  },
  'warrior.bladesworn.tactical-reload': ({
    context,
    skill,
    at
  }: {
    context: WarriorSchedulerContext;
    skill: WarriorSkill;
    at: number;
  }): void => {
    reloadBladeswornAmmo(context, at);
    bladeswornState.from(context).tacticalReloadUntil = at + 10;
    emitSkillBuff(context, {
      at,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Tactical Reload',
      kind: 'tactical-reload',
      stacks: 1,
      duration: 10
    });
  },
  'warrior.bladesworn.reset-dragon-trigger': ({ context }: { context: WarriorSchedulerContext }): void => {
    // Dragonspike Mine has no internal cooldown on its Dragon Trigger reset.
    context.state.cooldowns.delete(ID.DRAGON_TRIGGER);
  }
});

function activeCartridgeWindow(state: ReturnType<typeof bladeswornState.from>, at: number) {
  for (let index = state.overchargedCartridgeWindows.length - 1; index >= 0; index -= 1) {
    const window = state.overchargedCartridgeWindows[index];
    if (window.startedAt <= at && window.expiresAt > at) return window;
  }

  return undefined;
}

// Decorate qualifying player explosions with Guns and Glory's extendable window
// and the currently active cartridge window's Burning payload.
export function observeBladeswornEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    event.damageKind !== 'explosion' ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }

  const state = bladeswornState.from(context);
  if (hasTrait(context, TRAIT.GUNS_AND_GLORY)) {
    const profile = warriorBalanceProfile(context, PROFILE.gunsAndGlory);
    const remaining = Math.max(0, state.gunsAndGloryUntil - event.at);
    const duration = Math.min(Number(profile?.maximumStacks ?? 12), remaining + Number(profile?.resourceGain ?? 3));
    state.gunsAndGloryUntil = event.at + duration;
    emitSkillBuff(context, {
      cause: event,

      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.GUNS_AND_GLORY,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Guns and Glory',
      kind: 'guns-and-glory',
      stacks: 1,
      duration
    });
  }

  const cartridges = activeCartridgeWindow(state, event.at);
  if (cartridges) {
    const burning = warriorBalanceProfileEffect(
      warriorBalanceProfile(context, PROFILE.overchargedCartridges),
      'condition',
      cartridges.supercharged ? 1 : 0
    );
    emitSkillCondition(context, {
      cause: event,

      at: event.at,
      source: 'Warrior',
      sourceId: ID.OVERCHARGED_CARTRIDGES,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Overcharged Cartridges — Burning',
      condition: 'Burning',
      stacks: Number(burning?.stacks ?? 1),
      duration: cartridges.burningDuration
    });
  }
}
