import type { ScheduledTask } from '#gw2/platform/execution/types.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { EPSILON } from '#kernel/core/clock.js';
import { emitTransitionLockout } from '#gw2/platform/skills/transition-delays.js';
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitEngineerBarSwap } from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import {
  HOLOSMITH_FORGE_TOGGLE_SKILL_IDS,
  HOLOSMITH_HEAT
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { EngineerCastContext, EngineerSchedulerContext, EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { clamp } from '#kernel/core/numeric.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

interface PhotonForgeHeatPayload {
  readonly skillId: string | number;
  readonly skillName: string;
  readonly amount: number;
  readonly persistsOutsideForge: boolean;
}

interface PhotonForgeOverheatPenaltyPayload {
  readonly seconds: number;
}

const PHOTON_FORGE_PASSIVE_HEAT_TASK = 'engineer.photon-forge-passive-heat';
const PHOTON_FORGE_OVERHEAT_PENALTY_TASK = 'engineer.photon-forge-overheat-penalty';

/** Converts the profiled passive heat rate, including Light Density Amplifier, to one cadence tick. */
function passiveHeatPerTick(context: EngineerSchedulerContext): number {
  const heatPerSecond =
    balanceProfileValueFromContext(
      context,
      PROFILE.heat,
      'energyRegenerationPerSecond',
      HOLOSMITH_HEAT.basePassivePerSecond
    ) +
    (hasTrait(context.config, TRAIT.LIGHT_DENSITY_AMPLIFIER)
      ? balanceProfileValueFromContext(context, PROFILE.heat, 'resourceGain', HOLOSMITH_HEAT.lightDensityBonusPerSecond)
      : 0);

  // Scale profile rates to the resource cadence so 2%/s becomes 0.2% per 100 ms.
  return heatPerSecond * HOLOSMITH_HEAT.heatTickInterval;
}

/** Returns the cooling due on one cadence tick after accounting for Forge state, delay, and PBM. */
function passiveCoolingPerTick(context: EngineerSchedulerContext, at: number): number {
  const state = holosmithState.from(context);
  if ((state.photonForgeActive && !state.overheated) || state.forgeExitedAt == null) return 0;
  if (hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) && !state.overheated) return 0;

  const elapsedSinceExit = at - state.forgeExitedAt;
  if (elapsedSinceExit <= HOLOSMITH_HEAT.coolingDelay + EPSILON) return 0;
  const coolingPerSecond =
    elapsedSinceExit <= HOLOSMITH_HEAT.fastCoolingStartsAt + EPSILON
      ? HOLOSMITH_HEAT.slowCoolingPerSecond
      : HOLOSMITH_HEAT.fastCoolingPerSecond;

  // Scale both cooling phases to the shared cadence: 5%/s and 10%/s become 0.5% and 1% per tick.
  return coolingPerSecond * HOLOSMITH_HEAT.heatTickInterval;
}

/** Advances the heat cadence while rounding repeated additions onto stable event-ordering boundaries. */
function nextPassiveHeatTick(at: number): number {
  return Math.round((at + HOLOSMITH_HEAT.heatTickInterval) * 1e9) / 1e9;
}

/** Emits one profiled Enhanced Capacity Storage Unit might pulse. */
function emitEnhancedCapacityMight(context: EngineerSchedulerContext, at: number): void {
  const boon = balanceProfileEffectFromContext(context, PROFILE.enhancedCapacity, 'boon');
  const sourceSkill = {
    id: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
    name: 'Enhanced Capacity Storage Unit'
  } as EngineerSkill;
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
    actorType: 'player',
    name: 'Enhanced Capacity Storage Unit — might',
    kind: 'might',
    duration: gw2SchedulerBoonDuration(context, sourceSkill, 'might', balanceProfileValue(boon, 'duration', 6)),
    stacks: balanceProfileValue(boon, 'stacks', 2)
  });
}

/** Emits the first ECSU might pulse immediately when a discrete heat gain crosses the threshold. */
function triggerInstantEnhancedCapacityMight(
  context: EngineerSchedulerContext,
  at: number,
  previousHeat: number
): void {
  const state = holosmithState.from(context);
  if (
    !hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) ||
    previousHeat > HOLOSMITH_HEAT.enhancedCapacityThreshold ||
    state.heat <= HOLOSMITH_HEAT.enhancedCapacityThreshold
  )
    return;
  emitEnhancedCapacityMight(context, at);
  enhancedCapacityMight.start(context, {
    key: 'might',
    at: at + balanceProfileValueFromContext(context, PROFILE.enhancedCapacity, 'pulseInterval', 1),
    captured: {}
  });
}

// Might settles before same-time heat tasks, including the final pulse at a cooling boundary.
export const enhancedCapacityMight = timedEffect<EngineerSchedulerContext, object>({
  id: 'engineer.enhanced-capacity-might',
  priority: -200,
  interval: (context) => balanceProfileValueFromContext(context, PROFILE.enhancedCapacity, 'pulseInterval', 1),
  effectsAt(context, at) {
    if (holosmithState.from(context).heat <= HOLOSMITH_HEAT.enhancedCapacityThreshold) return false;
    emitEnhancedCapacityMight(context, at);
  }
});

/** Replaces Solar Focusing Lens charges and opens their profiled activation window. */
export function grantSolarFocusingLens(context: EngineerSchedulerContext, at: number, stacks: number): void {
  if (!hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)) return;
  // Grants cross into the resolver at their activation time; only impacts spend charges.
  context.emit({
    type: 'engineer.solar-focusing-lens',
    at,
    source: 'Trait',
    sourceId: TRAIT.SOLAR_FOCUSING_LENS,
    actorType: 'player',
    stacks,
    duration: balanceProfileValueFromContext(
      context,
      PROFILE.solarFocusingLens,
      'durationMultiplier',
      HOLOSMITH_HEAT.solarFocusingLensDuration
    )
  });
}

// Places every tool-belt skill except the Forge toggle on at least the overheat
// cooldown. A longer existing cooldown wins so overheat never shortens a skill.
function applyToolbeltOverheatPenalty(context: EngineerSchedulerContext, at: number, seconds: number): void {
  for (const skill of context.catalog.skills) {
    if (!skill.toolbeltParentName || HOLOSMITH_FORGE_TOGGLE_SKILL_IDS.has(Number(skill.id))) continue;
    const existingReadyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    context.state.cooldowns.set(skill.id, Math.max(existingReadyAt, at + seconds));
  }
}

// Schedules the tool-belt penalty with Overheat's delayed damage so skills stay
// usable during the measured 1.56-second window after Overheat begins.
function scheduleToolbeltOverheatPenalty(context: EngineerSchedulerContext, at: number, seconds: number): void {
  context.tasks.schedule({
    type: PHOTON_FORGE_OVERHEAT_PENALTY_TASK,
    at,
    payload: { seconds }
  });
}

/** Emits the delayed strike and burning packets owned by Photonic Blasting Module. */
function emitPhotonicBlastingModuleEffects(context: EngineerSchedulerContext, effectAt: number): void {
  const strike = balanceProfileEffectFromContext(context, PROFILE.photonicBlastingModule, 'strike');
  const condition = balanceProfileEffectFromContext(context, PROFILE.photonicBlastingModule, 'condition');
  // The explosion owns the blast finisher and resolves before its same-time condition packet.
  emitSkillDamage(context, {
    at: effectAt,
    source: 'Trait',
    sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
    actorType: 'player',
    skillName: 'Photonic Blasting Module',
    name: 'Photonic Blasting Module',
    coefficient: balanceProfileValue(strike, 'coefficient', 5),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: 'Unequipped',
    explosion: true,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  });
  // Burning shares the delayed PBM timestamp but remains a separate canonical effect application.
  emitSkillCondition(context, {
    at: effectAt,
    source: 'Trait',
    sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
    skillName: 'Photonic Blasting Module',
    name: 'Photonic Blasting Module — Burning',
    condition: 'Burning',
    stacks: balanceProfileValue(condition, 'stacks', 7),
    duration: balanceProfileValue(condition, 'duration', 6)
  });
}

/** Locks Forge attacks at maximum heat; the rotation owns exit while Overheat consequences remain automatic. */
function forceOverheat(context: EngineerSchedulerContext, at: number): void {
  const state = holosmithState.from(context);
  const photonicBlastingModule = hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE);
  const effectDelay = photonicBlastingModule
    ? balanceProfileValueFromContext(
        context,
        PROFILE.photonicBlastingModule,
        'initialDelay',
        HOLOSMITH_HEAT.overheatEffectDelay
      )
    : HOLOSMITH_HEAT.overheatEffectDelay;
  const effectAt = at + effectDelay;
  state.heat = state.maximumHeat;
  state.overheated = true;
  // Cooling follows the physical Overheat timestamp even while the rotation still owes its bar exit.
  state.forgeExitedAt = at;
  startPassiveHeatCadence(context, at);
  scheduleToolbeltOverheatPenalty(
    context,
    effectAt,
    photonicBlastingModule
      ? balanceProfileValueFromContext(context, PROFILE.photonicBlastingModule, 'cooldown', 5)
      : balanceProfileValueFromContext(context, PROFILE.overheat, 'maximumStacks', 15)
  );

  // Publish maximum heat at the overheat timestamp. The module blast and its
  // Solar Focusing Lens charges become active after the observed delay.
  emitEngineerStateSnapshot(context, at, 'overheat');
  grantSolarFocusingLens(
    context,
    photonicBlastingModule ? effectAt : at,
    balanceProfileValueFromContext(context, PROFILE.solarFocusingLens, 'maximumStacks', 6)
  );
  if (photonicBlastingModule) emitPhotonicBlastingModuleEffects(context, effectAt);
}

/** Clamps heat between discrete heat/cooling tasks and publishes changes. */
export function advancePhotonForgeState(context: EngineerSchedulerContext, target: number): void {
  const state = holosmithState.from(context);
  const from = Number(state.heatUpdatedAt || 0);
  if (target <= from) return;
  const previousHeat = state.heat;
  const heat = Number(state.heat || 0);
  state.heat = clamp(heat, 0, state.maximumHeat);
  // Arm preheated runs on their first advance, after opening packets have been authored.
  // Later advances only reconcile eligibility; the timed instance retains the pulse deadline.
  if (hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)) {
    if (heat <= HOLOSMITH_HEAT.enhancedCapacityThreshold) enhancedCapacityMight.cancelKey(context, 'might');
    else if (!Number.isFinite(enhancedCapacityMight.nextAt(context)))
      enhancedCapacityMight.start(context, { key: 'might', at: from, captured: {} });
  }

  state.heatUpdatedAt = target;
  if (state.heat !== previousHeat) {
    emitEngineerStateSnapshot(context, target, 'passive-heat');
  }
}

/** Restarts passive heat processing one cadence tick after a Forge state transition. */
function startPassiveHeatCadence(context: EngineerSchedulerContext, at: number): void {
  const state = holosmithState.from(context);
  state.passiveHeatAt = nextPassiveHeatTick(at);
  passiveHeat.start(context, { key: 'heat', at: state.passiveHeatAt, captured: {} });
}

/** Starts cooling cadence for simulations configured with nonzero initial heat. */
export function initializePhotonForgeHeat(context: EngineerSchedulerContext): void {
  const state = holosmithState.from(context);
  // Preheated simulations start the same 100 ms cooling cadence as a Forge exit.
  if (state.heat > EPSILON && state.forgeExitedAt != null) {
    startPassiveHeatCadence(context, Math.max(context.state.time, state.forgeExitedAt));
  }
}

/** Processes one validated passive heat or cooling tick and schedules the next tick when needed. */
function applyPassiveHeat(context: EngineerSchedulerContext, at: number): void {
  const state = holosmithState.from(context);

  const previousHeat = state.heat;
  if (state.photonForgeActive && !state.overheated) {
    // The Forge-relative tick overheats only when heat was already capped at tick
    // start, so passive heat that fills the bar gets one final 100 ms window.
    if (state.heat >= state.maximumHeat - EPSILON) {
      forceOverheat(context, at);
      return;
    }

    state.heat = Math.min(state.maximumHeat, Math.round((state.heat + passiveHeatPerTick(context)) * 1e9) / 1e9);
    triggerInstantEnhancedCapacityMight(context, at, previousHeat);
  } else {
    state.heat = Math.max(0, Math.round((state.heat - passiveCoolingPerTick(context, at)) * 1e9) / 1e9);
    if (state.heat <= EPSILON) {
      state.heat = 0;
      // Reaching zero cannot re-enable the exhausted Forge bar before its explicit exit.
      if (!state.photonForgeActive) state.overheated = false;
    }
  }

  if (state.heat !== previousHeat) {
    emitEngineerStateSnapshot(context, at, 'passive-heat');
  }
}

/** Skill heat retains priority over passive heat; replacement retires the previous Forge cadence. */
export const passiveHeat = timedEffect({
  id: PHOTON_FORGE_PASSIVE_HEAT_TASK,
  priority: 100,
  effectsAt: applyPassiveHeat,
  nextAt(context: EngineerSchedulerContext, at: number) {
    const state = holosmithState.from(context);
    const coolingGraceActive =
      !state.photonForgeActive &&
      state.forgeExitedAt != null &&
      at <= state.forgeExitedAt + HOLOSMITH_HEAT.coolingDelay + EPSILON;
    if ((state.photonForgeActive && !state.overheated) || state.heat > EPSILON || coolingGraceActive) {
      state.passiveHeatAt = nextPassiveHeatTick(at);
    } else {
      state.passiveHeatAt = null;
    }

    return state.passiveHeatAt;
  }
});

/** Applies a deferred Overheat lockout to eligible tool-belt cooldowns. */
export function handlePhotonForgeOverheatPenalty(
  context: EngineerSchedulerContext,
  task: ScheduledTask<PhotonForgeOverheatPenaltyPayload>
): void {
  applyToolbeltOverheatPenalty(context, task.at, Math.max(0, Number(task.payload?.seconds || 0)));
}

/** Enters Photon Forge, starts heat cadence, and applies entry lockout and trait state. */
function enterPhotonForge(context: EngineerCastContext, skill: EngineerSkill): void {
  emitTransitionLockout(context, 'forgeEntryMs', context.effectiveEnd, skill);
  const state = holosmithState.from(context);
  const coreState = professionCoreState(context);
  const at = context.effectiveEnd;
  const baseKitLockout = balanceProfileValueFromContext(context, PROFILE.heat, 'cooldown', 6);
  coreState.activeKit = '';
  state.photonForgeActive = true;
  state.forgeExitedAt = null;
  startPassiveHeatCadence(context, at);
  // Photon Forge's kit lockout behaves as recharge, so route its six-second
  // base duration through the shared recharge rules that apply Alacrity.
  state.kitLockoutUntil = at + context.rechargeDurationFor({ ...skill, cooldown: baseKitLockout }, at);
  grantSolarFocusingLens(
    context,
    at,
    balanceProfileValueFromContext(context, PROFILE.solarFocusingLens, 'minimumStacks', 2)
  );
  emitEngineerBarSwap(context, skill, at);
  emitEngineerStateSnapshot(context, at, 'enter-forge');
}

/** Exits Photon Forge voluntarily and starts cooling and exit trait state. */
function exitPhotonForge(context: EngineerCastContext, skill: EngineerSkill): void {
  emitTransitionLockout(context, 'forgeExitMs', context.effectiveEnd, skill);
  const state = holosmithState.from(context);
  const at = context.effectiveEnd;
  state.photonForgeActive = false;
  // Overheat already owns its Lens grant; acknowledging its exit must not replace those charges.
  if (!state.overheated) {
    state.forgeExitedAt = at;
    startPassiveHeatCadence(context, at);
    grantSolarFocusingLens(
      context,
      at,
      balanceProfileValueFromContext(context, PROFILE.solarFocusingLens, 'minimumStacks', 2)
    );
  }

  if (state.heat === 0) state.overheated = false;
  emitEngineerBarSwap(context, skill, at);
  emitEngineerStateSnapshot(context, at, 'exit-forge');
}

/** Queues a skill-owned heat change, optionally allowing it to land after Forge exit. */
function scheduleHeatPulse(
  context: EngineerCastContext,
  skill: EngineerSkill,
  times: readonly number[],
  amount: number,
  persistsOutsideForge = false
): void {
  skillHeat.start(context, {
    times,
    captured: {
      skillId: skill.id,
      skillName: skill.name,
      amount,
      persistsOutsideForge
    }
  });
}

/** Allows skill heat only while Photon Forge is active and below Overheat. */
function canApplyHeat(context: EngineerCastContext, skill: HolosmithSkill): boolean {
  const state = holosmithState.from(context);
  return state.photonForgeActive && !state.overheated && Number(skill.heatGain) > 0;
}

// Match Corona Burst heat to its five quickness-scaled damage pulses.
const CORONA_QUICKNESS_PULSE_OFFSETS_MS = Object.freeze([400, 760, 1120, 1480, 1800]);

/** Schedules every committed Corona Burst pulse, including pulses that land after Forge exit. */
function applyCoronaBurstHeat(context: EngineerCastContext, skill: HolosmithSkill): void {
  if (!canApplyHeat(context, skill)) return;
  const elapsedMs = Math.max(0, (context.effectiveEnd - context.start) * 1000);
  if (elapsedMs + EPSILON * 1000 < CORONA_QUICKNESS_PULSE_OFFSETS_MS[0]) return;
  const heatPerPulse = Number(skill.heatGain) / CORONA_QUICKNESS_PULSE_OFFSETS_MS.length;
  scheduleHeatPulse(
    context,
    skill,
    CORONA_QUICKNESS_PULSE_OFFSETS_MS.map((offsetMs) => context.start + offsetMs / 1000),
    heatPerPulse,
    true
  );
}

// Match Photon Blitz heat to projectile launches rather than impacts.
const PHOTON_BLITZ_PULSE_OFFSETS_MS = Object.freeze([240, 400, 480, 640, 720, 880, 960, 1120]);

/** Schedules heat only for Photon Blitz projectiles launched before the channel ends. */
function applyPhotonBlitzHeat(context: EngineerCastContext, skill: HolosmithSkill): void {
  if (!canApplyHeat(context, skill)) return;
  const elapsedMs = Math.max(0, (context.effectiveEnd - context.start) * 1000);
  const heatPerPulse = Number(skill.heatGain) / PHOTON_BLITZ_PULSE_OFFSETS_MS.length;
  scheduleHeatPulse(
    context,
    skill,
    PHOTON_BLITZ_PULSE_OFFSETS_MS.filter((offsetMs) => offsetMs <= elapsedMs + EPSILON * 1000).map(
      (offsetMs) => context.start + offsetMs / 1000
    ),
    heatPerPulse
  );
}

/** Schedules an ordinary Forge attack's heat at completion or its interrupt commit point. */
function applyHeat(context: EngineerCastContext, skill: HolosmithSkill): void {
  if (!canApplyHeat(context, skill)) return;
  const elapsedMs = Math.max(0, (context.effectiveEnd - context.start) * 1000);
  if (castWasInterrupted(context)) {
    const commitMs = Number(skill.interruptCommitMs);
    if (!Number.isFinite(commitMs) || elapsedMs + EPSILON * 1000 < commitMs) return;
  }

  // A Forge attack that crossed its interrupt commit point already fired; its
  // authored heat survives cancelling the remaining animation/aftercast too.
  scheduleHeatPulse(context, skill, [context.effectiveEnd], Number(skill.heatGain));
}

/** Applies a scheduled skill heat pulse, including immediate ECSU threshold payoff and a state snapshot. */
export const skillHeat = timedEffect<EngineerSchedulerContext, PhotonForgeHeatPayload>({
  id: 'engineer.photon-forge-heat',
  effectsAt(context, at, payload) {
    const state = holosmithState.from(context);
    if (state.overheated || (!state.photonForgeActive && payload.persistsOutsideForge !== true)) return;
    const previousHeat = state.heat;
    state.heat = grantCapped(state.heat, Number(payload.amount || 0), state.maximumHeat);
    triggerInstantEnhancedCapacityMight(context, at, previousHeat);
    emitEngineerStateSnapshot(context, at, 'heat');
  }
});

/** Invokes canonical Vent Exhaust effects and removes its authored heat amount. */
function triggerVentExhaust(context: EngineerCastContext, triggeringSkill: EngineerSkill, at: number): void {
  const ventExhaust: HolosmithSkill | undefined = context.catalog.skillsById.get(ID.VENT_EXHAUST);
  if (!ventExhaust) return;
  context.emit({
    type: 'proc',
    at,
    source: 'engineer',
    sourceId: ventExhaust.id,
    actorType: 'player',
    name: ventExhaust.name,
    procType: 'skill',
    sourceSkill: triggeringSkill.name,
    icon: ventExhaust.icon
  });
  // Materialize the canonical effect list so UI identity, packets, and trait attribution stay aligned.
  const activationId = context.createActivationId('vent-exhaust');
  for (const effect of ventExhaust.effects || []) {
    const applications = materializeSkillEffectApplications({
      skill: ventExhaust,
      effect,
      start: at,
      fullEnd: at,
      baseEvent: {
        activationId,
        source: 'engineer',
        sourceId: ventExhaust.id,
        actorType: effect.actorType || 'player',
        skillId: ventExhaust.id,
        skillName: ventExhaust.name,
        triggeredBy: triggeringSkill.name
      },
      skillWeaponFallback: 'Unequipped'
    });
    for (const application of applications) context.emit(application.event);
  }

  // Vent heat immediately after its combat packets are queued at the same timestamp.
  const state = holosmithState.from(context);
  state.heat = Math.max(0, state.heat - Math.max(0, Number(ventExhaust.heatLoss || 0)));
  state.heatUpdatedAt = at;
  if (state.heat === 0 && !state.photonForgeActive) state.overheated = false;
  emitEngineerStateSnapshot(context, at, 'vent-exhaust');
}

/**
 * Grants Thermal Release Valve's dodge boon and invokes Vent Exhaust when heat may be spent,
 * preserving maximum heat while Photonic Blasting Module awaits its explosion.
 */
export function triggerThermalReleaseValve(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.config, TRAIT.THERMAL_RELEASE_VALVE)) return;
  const state = holosmithState.from(context);
  const boon = balanceProfileEffectFromContext(context, PROFILE.thermalReleaseValve, 'boon');
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.THERMAL_RELEASE_VALVE,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Thermal Release Valve — vigor',
    kind: 'vigor',
    duration: gw2SchedulerBoonDuration(context, skill, 'vigor', balanceProfileValue(boon, 'duration', 3)),
    stacks: balanceProfileValue(boon, 'stacks', 1)
  });
  if (state.heat <= 0 || (hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) && !state.overheated)) return;
  triggerVentExhaust(context, skill, at);
}

/**
 * Holosmith decoration for the Core kit transition. Core equips the kit; the
 * active Holosmith slice owns leaving Photon Forge and its trait payoff.
 * This path skips the Deactivate Photon Forge skill because the player swapped
 * a kit rather than pressing the deactivate button.
 */
export function handleHolosmithKitEquip(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = holosmithState.from(context);
  if (skill.handlerId !== 'engineer.kit-equip' || !state.photonForgeActive) return;
  const at = context.effectiveEnd;
  emitTransitionLockout(context, 'forgeExitMs', at, skill);
  state.photonForgeActive = false;
  // A kit can acknowledge the exit too, without replacing Overheat's pending Lens grant.
  if (!state.overheated) {
    state.forgeExitedAt = at;
    startPassiveHeatCadence(context, at);
    grantSolarFocusingLens(
      context,
      at,
      balanceProfileValueFromContext(context, PROFILE.solarFocusingLens, 'minimumStacks', 2)
    );
  }

  if (state.heat === 0) state.overheated = false;
}

/** Routes Photon Forge handler IDs to entry, exit, and skill-heat logic. */
export const engineerPhotonForgeSkillHandlers = Object.freeze({
  'engineer.photon-forge-enter': enterPhotonForge,
  'engineer.photon-forge-exit': exitPhotonForge,
  'engineer.heat': applyHeat,
  'engineer.corona-burst-heat': applyCoronaBurstHeat,
  'engineer.photon-blitz-heat': applyPhotonBlitzHeat
});
