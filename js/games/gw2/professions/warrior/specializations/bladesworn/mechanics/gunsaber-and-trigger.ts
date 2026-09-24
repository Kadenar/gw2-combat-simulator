import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { recordBladeswornAmmoSpend } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/ammunition.js';
import { durationStackingBoonCapSeconds, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';

import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { dragonChargeTickOffsetSeconds } from '#gw2/professions/warrior/data/dragon-charges.js';
import {
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent,
  dragonSlashCoefficient,
  dragonFlowPerInterval,
  maximumDragonCharges,
  projectDragonCharges,
  projectDragonFlow,
  requestedDragonCharges,
  type DragonFlowRateSegment
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { applyWarriorBurstSpendTraits } from '#gw2/professions/warrior/core/traits/index.js';

import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';
import {
  applyBladeswornCompletionTraits,
  applyDragonSlashTraits,
  applyDragonTriggerEntryTraits,
  applyGunsaberEntryTraits,
  observeBladeswornExplosionTraits,
  prepareGunsaberSwapTraits
} from '#gw2/professions/warrior/specializations/bladesworn/traits/index.js';
import { clamp } from '#kernel/core/numeric.js';

function emitGunsaberWeaponSwap(context: WarriorCastContext, skill: WarriorSkill): void {
  resetAutoattackChains(context);
  prepareGunsaberSwapTraits(context);

  // Every bar transition locks both sides of the swap button, including Dragon Trigger's implicit Gunsaber entry.
  const swapSkill = skill.id === ID.DRAGON_TRIGGER ? context.catalog.skillsById.get(ID.UNSHEATHE_GUNSABER) : skill;
  if (swapSkill) {
    const readyAt =
      skill.id === ID.DRAGON_TRIGGER
        ? context.effectiveEnd + context.rechargeDurationFor(swapSkill, context.effectiveEnd)
        : context.rechargeStart + context.rechargeDuration;
    context.state.cooldowns.set(ID.UNSHEATHE_GUNSABER, readyAt);
    context.state.cooldowns.set(ID.SHEATHE_GUNSABER, readyAt);
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

// Start recharge on exit so charging time never consumes Dragon Trigger's cooldown.
function exitDragonTrigger(context: WarriorSchedulerContext, at: number): void {
  const state = bladeswornState.from(context);
  if (!state.dragonTriggerActive) return;
  const skill = context.catalog.skillsById.get(ID.DRAGON_TRIGGER);
  if (skill) context.state.cooldowns.set(skill.id, at + context.rechargeDurationFor(skill, at));
  state.dragonTriggerActive = false;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 0;
  state.nextDragonChargeAt = 0;
  state.dragonChargeTickCount = 0;
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = 1;
  state.dragonTriggerRotationIndex = -1;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = '';
}

export function enterGunsaber(context: WarriorCastContext, skill: WarriorSkill): void {
  bladeswornState.from(context).gunsaberActive = true;
  emitGunsaberWeaponSwap(context, skill);
  applyGunsaberEntryTraits(context, context.effectiveEnd);
}

export function exitGunsaber(context: WarriorCastContext, skill: WarriorSkill): void {
  exitDragonTrigger(context, context.effectiveEnd);
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

  const dragonTriggerProfile = requireBalanceProfileFromContext(context, PROFILE.dragonTrigger);
  // Entry spends the activation cost before charging; subsequent charge ticks pay their own Flow cost.
  const entryFlowCost = balanceProfileNumber(dragonTriggerProfile, 'threshold');
  state.flow = Math.max(0, state.flow - entryFlowCost);
  state.dragonTriggerChargeDeadline = canonicalTime(
    context.effectiveEnd + balanceProfileNumber(dragonTriggerProfile, 'cooldown')
  );
  state.dragonCharges = 0;
  // Tactical Reload doubles charge gain per tick. It is consumed immediately
  // so it only applies to the single Dragon Trigger entry it was active for, including entry exactly at expiry.
  state.dragonChargesPerInterval =
    state.tacticalReloadUntil > 0 && context.effectiveEnd <= state.tacticalReloadUntil ? 2 : 1;
  if (state.dragonChargesPerInterval > 1) state.tacticalReloadUntil = 0;
  state.dragonChargeTickCount = 0;
  state.nextDragonChargeAt =
    context.effectiveEnd +
    dragonChargeTickOffsetSeconds(1, maximumDragonCharges(context), state.dragonChargesPerInterval);
  state.dragonTriggerRotationIndex = context.commandIndex;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = context.reservationId;
  emitDragonTriggerEntry(context, skill, entryFlowCost);
  applyDragonTriggerEntryTraits(context, skill);
}

export function useDragonSlash(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = bladeswornState.from(context);
  const maximumCharges = maximumDragonCharges(context);
  const charges = clamp(state.dragonCharges, 1, maximumCharges);
  const requestedCharges = requestedDragonCharges(context, maximumCharges);
  const minimum = Number(skill.dragonSlashMinimumCoefficient || 0);
  const maximum = Number(skill.dragonSlashMaximumCoefficient ?? minimum);
  const coefficient = dragonSlashCoefficient(minimum, maximum, charges, maximumCharges);
  // Dragon Slash Force lands 720ms after release to match its observed damage packet;
  // all other Dragon Slash variants hit at cast end.
  const impactAt =
    skill.id === ID.DRAGON_SLASH_FORCE || skill.id === ID.SHARP_DRAGON_SLASH_FORCE
      ? context.start + 0.72
      : context.effectiveEnd;
  const adrenalineSpent = dragonChargesToAdrenalineSpent(charges);
  const burstMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.burstMastery);
  applyWarriorBurstSpendTraits(context, skill, adrenalineSpent, {
    resourceSpent: state.dragonTriggerFlowSpent,
    resourceRefundRate: balanceProfileNumber(burstMasteryProfile, 'resourceGain')
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
  const minimumBurningDuration = Number(skill.dragonSlashMinimumBurningDuration || 0);
  const maximumBurningDuration = Number(skill.dragonSlashMaximumBurningDuration || 0);
  if (minimumBurningDuration > 0 && maximumBurningDuration > 0) {
    // Sharp as the Wind converts charge into both Burning intensity and duration on one linear scale.
    // Separate Burning applications preserve the total, including any fractional final stack.
    const stacks = dragonSlashCoefficient(1, 20, charges, maximumCharges);
    const duration = dragonSlashCoefficient(minimumBurningDuration, maximumBurningDuration, charges, maximumCharges);
    for (let index = 0; index < Math.ceil(stacks); index += 1) {
      emitSkillCondition(context, {
        skill,
        at: impactAt,
        source: 'Warrior',
        condition: 'Burning',
        stacks: Math.min(1, stacks - index),
        duration
      });
    }
  }

  applyDragonSlashTraits(context, skill, impactAt);

  // Releasing the charge starts recharge immediately, while the slash is still casting.
  exitDragonTrigger(context, context.start);
}

// Consume Artillery Slash ammo, preserve its recharge lockout, and select the
// strike profile from the number of rounds committed.
export function useArtillerySlash(context: WarriorCastContext, skill: WarriorSkill): void {
  const charges = Math.max(1, Number(context.ammo?.charges || 1));
  const sharpAsTheWind = skill.id === ID.SHARP_ARTILLERY_SLASH;
  recordBladeswornAmmoSpend(context, charges, charges >= Number(context.ammo?.maximum || skill.ammo || 0));
  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt: context.rechargeStart + Math.max(context.rechargeDuration, context.ammoLockoutDuration)
  });

  const artilleryProfile = requireBalanceProfileFromContext(
    context,
    sharpAsTheWind ? PROFILE.sharpArtillerySlash : PROFILE.artillerySlash
  );
  const strike = requireEffect(
    artilleryProfile,
    'strike',
    sharpAsTheWind ? 'Strike' : charges >= 2 ? 'Two rounds' : 'One round'
  );

  if (strike)
    emitSkillDamage(context, {
      at: context.effectiveEnd,
      skillId: skill.id,
      sourceId: skill.id,
      skillName: skill.name,
      source: 'Warrior',
      actorType: 'player',
      coefficient: effectNumber(artilleryProfile, strike, 'coefficient'),
      skillWeapon: 'Gunsaber',
      damageKind: 'explosion',
      projectile: sharpAsTheWind,
      ...(sharpAsTheWind
        ? {
            comboFinishers: [
              {
                ownerId: 'warrior',
                finisherType: 'Projectile',
                ambiguousFieldSelection: 'oldest'
              }
            ]
          }
        : {})
    });
  if (sharpAsTheWind) {
    // The condition variant spends the same ammo pool while scaling its Bleeding payload by rounds consumed.
    const bleeding = requireEffect(artilleryProfile, 'condition', charges >= 2 ? 'Two rounds' : 'One round');

    if (bleeding)
      emitSkillCondition(context, {
        skill,
        at: context.effectiveEnd,
        source: 'Warrior',
        condition: String(bleeding.condition),
        stacks: effectNumber(artilleryProfile, bleeding, 'stacks'),
        duration: effectNumber(artilleryProfile, bleeding, 'duration')
      });
  }

  // Control is a sibling packet, not an unconditional consequence of spending ammunition.
  const control = requireEffect(artilleryProfile, 'control', 'Control');
  if (control)
    emitSkillControl(context, {
      at: context.effectiveEnd,
      skillId: skill.id,
      sourceId: skill.id,
      skillName: skill.name,
      source: 'Warrior',
      actorType: 'player',
      controlKind: sharpAsTheWind && charges >= 2 ? 'stun' : 'daze'
    });
}

// Split a time range at every Flow modifier boundary so Dragon Trigger projection
// can integrate the exact piecewise regeneration rate. Base regeneration only runs in combat,
// while Positive Flow keeps granting Flow before combat so precombat Flow Stabilizers carry over.
function dragonFlowRateSegments(
  context: WarriorSchedulerContext,
  from: number,
  to: number
): readonly DragonFlowRateSegment[] {
  if (!(to > from)) return [];
  const state = bladeswornState.from(context);
  // An explicit marker that has not been reached yet means combat has not begun within this range.
  const combatStart = context.hasExplicitCombatStart ? (context.combatStartTime ?? Infinity) : from;
  const boundaries = [
    from,
    to,
    combatStart,
    state.traitPositiveFlowStartedAt,
    state.traitPositiveFlowUntil,
    ...state.flowStabilizerWindows.flatMap((window) => [window.startedAt, window.expiresAt])
  ]
    .filter((at) => at > from && at < to)
    .concat(from, to)
    .sort((left, right) => left - right);
  const uniqueBoundaries = [...new Set(boundaries)];
  const segments: DragonFlowRateSegment[] = [];

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const baseFlow = balanceProfileNumber(resourcesProfile, 'energyRegenerationPerSecond');
  const stabilizerBonus = balanceProfileNumber(resourcesProfile, 'resourceGain');
  const positiveFlowBonus = balanceProfileNumber(resourcesProfile, 'attributePerStack');
  for (let index = 0; index < uniqueBoundaries.length - 1; index += 1) {
    const start = Number(uniqueBoundaries[index]);
    const end = Number(uniqueBoundaries[index + 1]);
    const sample = (start + end) / 2;
    const flowPerSecond =
      (sample >= combatStart ? baseFlow : 0) +
      state.flowStabilizerWindows.reduce(
        (bonus, window) => (sample >= window.startedAt && sample < window.expiresAt ? bonus + stabilizerBonus : bonus),
        0
      ) +
      // Trait regeneration scales with the same applied stacks shown in its buff and state bar.
      (sample >= state.traitPositiveFlowStartedAt && sample < state.traitPositiveFlowUntil
        ? positiveFlowBonus * state.traitPositiveFlowStacks
        : 0);
    // Idle precombat spans grant nothing, so they add no projection segment.
    if (flowPerSecond > 0) segments.push({ start, end, flowPerSecond });
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

function emitDragonTriggerEntry(context: WarriorCastContext, skill: WarriorSkill, entryFlowCost: number): void {
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
    amount: -entryFlowCost,
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

// Sample Fury at the exact cast instant, excluding this activation so Flow Stabilizer cannot grant its own bonus.
function furyActiveBeforeCurrentCast(
  context: WarriorSchedulerContext,
  activationId: string,
  castStart: number
): boolean {
  const configured = context.config.boons?.fury;
  if (configured === true || Number(configured || 0) > 0) return true;
  return (
    remainingDurationStackSeconds(
      boonApplicationsAt(
        context.events.filter((event) => event.activationId !== activationId),
        'fury',
        castStart
      ),
      castStart,
      {
        includes: (application) => application.resolvedAudience.includesSelf,
        maximum: durationStackingBoonCapSeconds('fury')
      }
    ) > 0
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
  const maximumCharges = maximumDragonCharges(context);
  const ticks = projectDragonCharges({
    startTime: state.flowUpdatedAt,
    firstTickAt: state.nextDragonChargeAt,
    flow: state.flow,
    maximumFlow: state.maximumFlow,
    initialCharges: state.dragonCharges,
    maximumCharges,
    chargesPerInterval: state.dragonChargesPerInterval,
    flowPerInterval,
    initialTickIndex: state.dragonChargeTickCount + 1,
    tickAt: (tickIndex) =>
      state.dragonTriggerStartedAt +
      dragonChargeTickOffsetSeconds(tickIndex, maximumCharges, state.dragonChargesPerInterval),
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
  }

  state.dragonChargeTickCount += ticks.length;
  state.nextDragonChargeAt =
    state.dragonTriggerStartedAt +
    dragonChargeTickOffsetSeconds(state.dragonChargeTickCount + 1, maximumCharges, state.dragonChargesPerInterval);

  gainPassiveFlow(context, state.flowUpdatedAt, target);
  state.flowUpdatedAt = target;
  if (target > state.dragonTriggerChargeDeadline) {
    exitDragonTrigger(context, state.dragonTriggerChargeDeadline);
  }
}

function reloadBladeswornAmmo(context: WarriorSchedulerContext, at: number): void {
  for (const skillId of context.state.ammo.keys()) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.specialization === 'Bladesworn') {
      context.cooldownController.restoreAmmo(skill, 1, at, 'retain');
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

  const overchargedCartridgesProfile = requireBalanceProfileFromContext(context, PROFILE.overchargedCartridges);
  const buff = requireEffect(
    overchargedCartridgesProfile,
    'buff',
    supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges'
  );
  // The selected cartridge buff owns its window; removed Burning leaves the strike bonus intact.
  if (!buff) return;
  const burning = requireEffect(
    overchargedCartridgesProfile,
    'condition',
    supercharged ? 'Supercharged Burning' : 'Overcharged Burning'
  );
  const duration = effectNumber(overchargedCartridgesProfile, buff, 'duration');
  state.overchargedCartridgeWindows.push({
    startedAt: at,
    expiresAt: at + duration,
    damageBonus: effectNumber(overchargedCartridgesProfile, buff, 'damageIncreasePerStack'),
    burningDuration: burning ? effectNumber(overchargedCartridgesProfile, burning, 'duration') : 0,
    supercharged
  });
  if (buff)
    emitSkillBuff(context, {
      at,
      source: 'Warrior',
      sourceId: ID.OVERCHARGED_CARTRIDGES,
      actorType: 'player',
      skillId: ID.OVERCHARGED_CARTRIDGES,
      skillName: 'Overcharged Cartridges',
      name: supercharged ? 'Supercharged Cartridges' : 'Overcharged Cartridges',
      kind: supercharged ? 'supercharged-cartridges' : 'overcharged-cartridges',
      stacks: effectNumber(overchargedCartridgesProfile, buff, 'stacks'),
      duration
    });
}

export function useOverchargedCartridges(context: WarriorCastContext, _skill: WarriorSkill): void {
  // The custom cartridge state must follow the skill's interrupt commit boundary.
  if (context.action.cancelled) return;
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

// Dragon Trigger only allows instant casts while charging. A skill with a cast bar drops back to plain Gunsaber
// without releasing a slash, so the stance ends (and starts recharging) when that cast begins.
export function exitDragonTriggerForCastBar(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!bladeswornState.from(context).dragonTriggerActive || skill.dragonSlash) return;
  if (context.fullEnd - context.start <= EPSILON) return;
  exitDragonTrigger(context, context.start);
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

  const dragonAdrenalineSpent = Math.max(
    0,
    Number(state.dragonAdrenalineSpentByActivation[context.reservationId] || 0)
  );
  applyBladeswornCompletionTraits(context, skill, roundsSpent, startedFull, dragonAdrenalineSpent, at);

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
    skill,
    at,
    castStart,
    activationId
  }: {
    context: WarriorSchedulerContext;
    skill: WarriorSkill;
    at: number;
    castStart: number;
    activationId: string;
  }): void => {
    const state = bladeswornState.from(context);
    if (furyActiveBeforeCurrentCast(context, activationId, castStart)) {
      state.flow = Math.min(state.maximumFlow, state.flow + 15);
    }

    // A removed Positive Flow packet cannot open a regeneration window; the conditional instant gain is independent.
    // The activating Flow Stabilizer skill owns the packet, so no catalog lookup is needed.
    const flow = requireEffect(skill, 'buff', 'Positive Flow');
    if (flow)
      state.flowStabilizerWindows.push({
        startedAt: at,
        expiresAt: gw2EffectExpiresAt(at, effectNumber(skill, flow, 'duration'))
      });
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
    // Consumption and the displayed buff share one absolute effect-tick deadline.
    bladeswornState.from(context).tacticalReloadUntil = gw2EffectExpiresAt(at, 10);
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
  observeBladeswornExplosionTraits(context, event);

  const cartridges = activeCartridgeWindow(state, event.at);
  if (cartridges) {
    const overchargedCartridgesProfile = requireBalanceProfileFromContext(context, PROFILE.overchargedCartridges);
    const burning = requireEffect(
      overchargedCartridgesProfile,
      'condition',
      cartridges.supercharged ? 'Supercharged Burning' : 'Overcharged Burning'
    );
    if (burning)
      emitSkillCondition(context, {
        cause: event,

        at: event.at,
        source: 'Warrior',
        sourceId: ID.OVERCHARGED_CARTRIDGES,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: event.skillId,
        skillName: event.skillName,
        name: 'Overcharged Cartridges — Burning',
        condition: 'Burning',
        stacks: effectNumber(overchargedCartridgesProfile, burning, 'stacks'),
        duration: cartridges.burningDuration
      });
  }
}
