import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { holosmithState } from '#gw2/content/professions/engineer/specializations/holosmith/state.js';
import { snapshotEngineerState } from '#gw2/content/professions/engineer/state.js';
import { decorateHolosmithHeatEvent } from '#gw2/content/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitEngineerBarSwap } from '#gw2/content/professions/engineer/core/mechanics/event-handlers.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '#gw2/content/professions/engineer/core/profiles.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/engineer/specializations/holosmith/profiles.js';
import {
  HOLOSMITH_CORONA_QUICKNESS_PULSE_OFFSETS_MS,
  HOLOSMITH_HEAT,
  HOLOSMITH_PHOTON_BLITZ_PULSE_OFFSETS_MS
} from '#gw2/content/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill,
  HolosmithState
} from '#gw2/content/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/content/professions/engineer/specializations/holosmith/types.js';

interface HeatSegment {
  readonly start: number;
  readonly end: number;
  readonly startHeat: number;
  readonly rate: number;
}

interface HighHeatInterval {
  readonly start: number;
  readonly end: number;
  readonly endsAbove: boolean;
}

interface PhotonForgeHeatPayload extends SchedulerRecord {
  readonly skillId: string | number;
  readonly skillName: string;
  readonly amount: number;
  readonly persistsOutsideForge: boolean;
}

interface PhotonForgePassiveHeatPayload extends SchedulerRecord {}

interface PhotonForgeOverheatPenaltyPayload extends SchedulerRecord {
  readonly seconds: number;
}

const CORONA_QUICKNESS_PULSE_OFFSETS_MS = HOLOSMITH_CORONA_QUICKNESS_PULSE_OFFSETS_MS;
const PHOTON_BLITZ_PULSE_OFFSETS_MS = HOLOSMITH_PHOTON_BLITZ_PULSE_OFFSETS_MS;
const PHOTON_FORGE_PASSIVE_HEAT_TASK = 'engineer.photon-forge-passive-heat';
const PHOTON_FORGE_OVERHEAT_PENALTY_TASK = 'engineer.photon-forge-overheat-penalty';

/** Converts the profiled passive heat rate, including Light Density Amplifier, to one cadence tick. */
function passiveHeatPerTick(context: EngineerSchedulerContext): number {
  const heatPerSecond =
    engineerBalanceValue(context, PROFILE.heat, 'energyRegenerationPerSecond', HOLOSMITH_HEAT.basePassivePerSecond) +
    (hasTrait(context.config, TRAIT.LIGHT_DENSITY_AMPLIFIER)
      ? engineerBalanceValue(context, PROFILE.heat, 'resourceGain', HOLOSMITH_HEAT.lightDensityBonusPerSecond)
      : 0);

  // Scale profile rates to the resource cadence so 2%/s becomes 0.2% per 100 ms.
  return heatPerSecond * HOLOSMITH_HEAT.heatTickInterval;
}

/** Returns the cooling due on one cadence tick after accounting for Forge state, delay, and PBM. */
function passiveCoolingPerTick(context: EngineerSchedulerContext, at: number): number {
  const state = holosmithState.from(context);
  if (state.photonForgeActive || state.forgeExitedAt == null) return 0;
  if (hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) && !state.overheated) return 0;

  const elapsedSinceExit = at - state.forgeExitedAt;
  if (elapsedSinceExit <= HOLOSMITH_HEAT.coolingDelay + context.epsilon) return 0;
  const coolingPerSecond =
    elapsedSinceExit <= HOLOSMITH_HEAT.fastCoolingStartsAt + context.epsilon
      ? HOLOSMITH_HEAT.slowCoolingPerSecond
      : HOLOSMITH_HEAT.fastCoolingPerSecond;

  // Scale both cooling phases to the shared cadence: 5%/s and 10%/s become 0.5% and 1% per tick.
  return coolingPerSecond * HOLOSMITH_HEAT.heatTickInterval;
}

/** Advances the heat cadence while rounding repeated additions onto stable event-ordering boundaries. */
function nextPassiveHeatTick(at: number): number {
  return Math.round((at + HOLOSMITH_HEAT.heatTickInterval) * 1e9) / 1e9;
}

// Records one linear heat segment and advances state.heat.
// When cooling, clamps end time so heat never goes below zero (avoids negative segments).
function appendHeatSegment(
  segments: HeatSegment[],
  state: HolosmithState,
  start: number,
  end: number,
  rate: number
): void {
  if (!(end > start)) return;
  const startHeat = Number(state.heat || 0);
  let segmentEnd = end;
  if (rate < 0 && startHeat + (end - start) * rate < 0) {
    segmentEnd = start + startHeat / -rate;
  }

  segments.push({
    start,
    end: segmentEnd,
    startHeat,
    rate
  });
  state.heat = Math.max(0, Math.min(state.maximumHeat, startHeat + (segmentEnd - start) * rate));
}

/** Clips a linear heat segment to the portion above ECSU's might threshold. */
function highHeatInterval(segment: HeatSegment): HighHeatInterval | null {
  const heatThreshold = HOLOSMITH_HEAT.enhancedCapacityThreshold;
  const endHeat = segment.startHeat + (segment.end - segment.start) * segment.rate;
  // Rising heat begins eligibility at the threshold crossing and remains eligible through the segment end.
  if (segment.rate > 0) {
    if (endHeat <= heatThreshold) return null;
    return {
      start:
        segment.startHeat > heatThreshold
          ? segment.start
          : segment.start + (heatThreshold - segment.startHeat) / segment.rate,
      end: segment.end,
      endsAbove: true
    };
  }

  // Falling heat ends eligibility at its threshold crossing and records whether the next segment stays eligible.
  if (segment.rate < 0) {
    if (segment.startHeat <= heatThreshold) return null;
    return {
      start: segment.start,
      end: endHeat > heatThreshold ? segment.end : segment.start + (segment.startHeat - heatThreshold) / -segment.rate,
      endsAbove: endHeat > heatThreshold
    };
  }

  // Flat segments are either wholly eligible or wholly below threshold.
  if (segment.startHeat <= heatThreshold) return null;
  return {
    start: segment.start,
    end: segment.end,
    endsAbove: true
  };
}

/** Emits one profiled Enhanced Capacity Storage Unit might pulse. */
function emitEnhancedCapacityMight(context: EngineerSchedulerContext, at: number): void {
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
    duration: gw2SchedulerBoonDuration(
      context,
      sourceSkill,
      'might',
      engineerBalanceEffectValue(context, PROFILE.enhancedCapacity, 'boon', 'duration', 6)
    ),
    stacks: engineerBalanceEffectValue(context, PROFILE.enhancedCapacity, 'boon', 'stacks', 2)
  });
}

/** Materializes ECSU might across high-heat segments while carrying pulse readiness between calls. */
function materializeEnhancedCapacityMight(context: EngineerSchedulerContext, segments: readonly HeatSegment[]): void {
  if (!hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)) return;
  const state = holosmithState.from(context);
  let readyAt = state.enhancedCapacityMightReadyAt;
  // Walk chronological high-heat intervals while retaining cadence across contiguous eligible segments.
  for (const segment of segments) {
    const interval = highHeatInterval(segment);
    if (!interval) {
      readyAt = null;
      continue;
    }

    if (readyAt == null || Number(readyAt) < interval.start - context.epsilon) {
      readyAt = interval.start;
    }

    // Emit every due pulse inside the interval, then carry the next boundary into later calls.
    while (Number(readyAt) <= interval.end + context.epsilon) {
      emitEnhancedCapacityMight(context, Number(readyAt));
      readyAt = Number(readyAt) + engineerBalanceValue(context, PROFILE.enhancedCapacity, 'pulseInterval', 1);
    }

    if (!interval.endsAbove) readyAt = null;
  }

  state.enhancedCapacityMightReadyAt = readyAt;
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
  state.enhancedCapacityMightReadyAt = at + engineerBalanceValue(context, PROFILE.enhancedCapacity, 'pulseInterval', 1);
}

/** Replaces Solar Focusing Lens charges and opens their profiled activation window. */
export function grantSolarFocusingLens(context: EngineerSchedulerContext, at: number, stacks: number): void {
  if (!hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)) return;
  const state = holosmithState.from(context);
  state.solarFocusingLensStacks = stacks;
  state.solarFocusingLensReadyAt = at;
  state.solarFocusingLensUntil =
    at +
    engineerBalanceValue(
      context,
      PROFILE.solarFocusingLens,
      'durationMultiplier',
      HOLOSMITH_HEAT.solarFocusingLensDuration
    );
}

// Places every tool-belt skill except the Forge toggle on at least the overheat
// cooldown. A longer existing cooldown wins so overheat never shortens a skill.
function applyToolbeltOverheatPenalty(context: EngineerSchedulerContext, at: number, seconds: number): void {
  for (const skill of context.catalog.skills) {
    if (
      !skill.toolbeltParentName ||
      skill.name === 'Engage Photon Forge' ||
      skill.name.startsWith('Deactivate Photon Forge')
    )
      continue;
    const existingReadyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    context.state.cooldowns.set(skill.id, Math.max(existingReadyAt, at + seconds));
  }
}

// Schedules the tool-belt penalty with Overheat's delayed damage so skills stay
// usable during the measured 1.56-second window after automatic forge ejection.
function scheduleToolbeltOverheatPenalty(context: EngineerSchedulerContext, at: number, seconds: number): void {
  context.tasks.schedule({
    type: PHOTON_FORGE_OVERHEAT_PENALTY_TASK,
    at,
    payload: { seconds }
  });
}

/** Emits the delayed strike and burning packets owned by Photonic Blasting Module. */
function emitPhotonicBlastingModuleEffects(context: EngineerSchedulerContext, effectAt: number): void {
  // The explosion owns the blast finisher and resolves before its same-time condition packet.
  emitSkillDamage(context, {
    at: effectAt,
    source: 'Trait',
    sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
    actorType: 'player',
    skillName: 'Photonic Blasting Module',
    name: 'Photonic Blasting Module',
    coefficient: engineerBalanceEffectValue(context, PROFILE.photonicBlastingModule, 'strike', 'coefficient', 5),
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
    actorType: 'player',
    skillName: 'Photonic Blasting Module',
    name: 'Photonic Blasting Module — Burning',
    condition: 'Burning',
    stacks: engineerBalanceEffectValue(context, PROFILE.photonicBlastingModule, 'condition', 'stacks', 7),
    duration: engineerBalanceEffectValue(context, PROFILE.photonicBlastingModule, 'condition', 'duration', 6)
  });
}

/** Ejects Photon Forge at maximum heat and schedules the delayed Overheat or PBM consequences. */
function forceOverheat(context: EngineerSchedulerContext, at: number): void {
  const state = holosmithState.from(context);
  const photonicBlastingModule = hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE);
  const effectDelay = photonicBlastingModule
    ? engineerBalanceValue(context, PROFILE.photonicBlastingModule, 'initialDelay', HOLOSMITH_HEAT.overheatEffectDelay)
    : HOLOSMITH_HEAT.overheatEffectDelay;
  const effectAt = at + effectDelay;
  state.heat = state.maximumHeat;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  state.overheated = true;
  startPassiveHeatCadence(context, at);
  professionCoreState(context).activeKit = '';
  scheduleToolbeltOverheatPenalty(
    context,
    effectAt,
    photonicBlastingModule
      ? engineerBalanceValue(context, PROFILE.photonicBlastingModule, 'cooldown', 5)
      : engineerBalanceValue(context, PROFILE.overheat, 'maximumStacks', 15)
  );

  // Publish maximum heat at the overheat timestamp. The module blast and its
  // Solar Focusing Lens charges become active after the observed delay.
  emitStateSnapshot(context, 'engineer', at, 'overheat', snapshotEngineerState(context.state.profession));
  grantSolarFocusingLens(
    context,
    photonicBlastingModule ? effectAt : at,
    engineerBalanceValue(context, PROFILE.solarFocusingLens, 'maximumStacks', 6)
  );
  if (photonicBlastingModule) emitPhotonicBlastingModuleEffects(context, effectAt);
}

/** Advances continuous heat bookkeeping to a target time without crossing discrete cadence tasks. */
export function advancePhotonForgeState(context: EngineerSchedulerContext, target: number): void {
  const state = holosmithState.from(context);
  const from = Number(state.heatUpdatedAt || 0);
  if (target <= from) return;
  const previousHeat = state.heat;
  const previousForgeActive = state.photonForgeActive;
  const previousOverheated = state.overheated;
  const segments: HeatSegment[] = [];

  // Passive gain and cooling are discrete 100 ms tasks. Keep heat flat between
  // those boundaries so heat-tier pulses observe the value active in each interval.
  appendHeatSegment(segments, state, from, target, 0);

  materializeEnhancedCapacityMight(context, segments);
  state.heatUpdatedAt = target;
  if (
    state.heat !== previousHeat ||
    state.photonForgeActive !== previousForgeActive ||
    state.overheated !== previousOverheated
  ) {
    emitStateSnapshot(context, 'engineer', target, 'passive-heat', snapshotEngineerState(context.state.profession));
  }
}

/** Schedules one low-priority heat cadence task so same-time skill heat resolves first. */
function schedulePassiveHeat(context: EngineerSchedulerContext, at: number): void {
  context.tasks.schedule({
    type: PHOTON_FORGE_PASSIVE_HEAT_TASK,
    at,
    // Skill heat at the same timestamp resolves before the resource tick checks the cap.
    priority: 100,
    payload: {}
  });
}

/** Restarts passive heat processing one cadence tick after a Forge state transition. */
function startPassiveHeatCadence(context: EngineerSchedulerContext, at: number): void {
  const state = holosmithState.from(context);
  state.passiveHeatAt = nextPassiveHeatTick(at);
  schedulePassiveHeat(context, state.passiveHeatAt);
}

/** Starts cooling cadence for simulations configured with nonzero initial heat. */
export function initializePhotonForgeHeat(context: EngineerSchedulerContext): void {
  const state = holosmithState.from(context);
  // Preheated simulations start the same 100 ms cooling cadence as a Forge exit.
  if (state.heat > context.epsilon && state.forgeExitedAt != null) {
    startPassiveHeatCadence(context, Math.max(context.state.time, state.forgeExitedAt));
  }
}

/** Processes one validated passive heat or cooling tick and schedules the next tick when needed. */
export function handlePhotonForgePassiveHeat(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<PhotonForgePassiveHeatPayload>
): void {
  const state = holosmithState.from(context);
  if (state.passiveHeatAt == null || Math.abs(state.passiveHeatAt - task.at) > context.epsilon) return;

  const previousHeat = state.heat;
  if (state.photonForgeActive) {
    // The Forge-relative tick ejects only when heat was already capped at tick
    // start, so passive heat that fills the bar gets one final 100 ms window.
    if (state.heat >= state.maximumHeat - context.epsilon) {
      forceOverheat(context, task.at);
      return;
    }

    state.heat = Math.min(state.maximumHeat, Math.round((state.heat + passiveHeatPerTick(context)) * 1e9) / 1e9);
    triggerInstantEnhancedCapacityMight(context, task.at, previousHeat);
  } else {
    state.heat = Math.max(0, Math.round((state.heat - passiveCoolingPerTick(context, task.at)) * 1e9) / 1e9);
    if (state.heat <= context.epsilon) {
      state.heat = 0;
      state.overheated = false;
    }
  }

  if (state.heat !== previousHeat) {
    emitStateSnapshot(context, 'engineer', task.at, 'passive-heat', snapshotEngineerState(context.state.profession));
  }

  const coolingGraceActive =
    !state.photonForgeActive &&
    state.forgeExitedAt != null &&
    task.at <= state.forgeExitedAt + HOLOSMITH_HEAT.coolingDelay + context.epsilon;
  if (state.photonForgeActive || state.heat > context.epsilon || coolingGraceActive) {
    startPassiveHeatCadence(context, task.at);
  } else {
    state.passiveHeatAt = null;
  }
}

/** Applies a deferred Overheat lockout to eligible tool-belt cooldowns. */
export function handlePhotonForgeOverheatPenalty(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<PhotonForgeOverheatPenaltyPayload>
): void {
  applyToolbeltOverheatPenalty(context, task.at, Math.max(0, Number(task.payload?.seconds || 0)));
}

/** Enters Photon Forge, starts heat cadence, and applies entry lockout and trait state. */
function enterPhotonForge(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = holosmithState.from(context);
  const coreState = professionCoreState(context);
  const at = context.effectiveEnd;
  const baseKitLockout = engineerBalanceValue(context, PROFILE.heat, 'cooldown', 6);
  coreState.activeKit = '';
  state.photonForgeActive = true;
  state.forgeExitedAt = null;
  startPassiveHeatCadence(context, at);
  // Photon Forge's kit lockout behaves as recharge, so route its six-second
  // base duration through the shared recharge rules that apply Alacrity.
  state.kitLockoutUntil = at + context.rechargeDurationFor({ ...skill, cooldown: baseKitLockout }, at);
  grantSolarFocusingLens(context, at, engineerBalanceValue(context, PROFILE.solarFocusingLens, 'minimumStacks', 2));
  emitEngineerBarSwap(context, skill, at);
  emitStateSnapshot(context, 'engineer', at, 'enter-forge', snapshotEngineerState(context.state.profession));
}

/** Exits Photon Forge voluntarily and starts cooling and exit trait state. */
function exitPhotonForge(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = holosmithState.from(context);
  const at = context.effectiveEnd;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  startPassiveHeatCadence(context, at);
  grantSolarFocusingLens(context, at, engineerBalanceValue(context, PROFILE.solarFocusingLens, 'minimumStacks', 2));
  emitEngineerBarSwap(context, skill, at);
  emitStateSnapshot(context, 'engineer', at, 'exit-forge', snapshotEngineerState(context.state.profession));
}

/** Queues a skill-owned heat change, optionally allowing it to land after Forge exit. */
function scheduleHeatPulse(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
  amount: number,
  persistsOutsideForge = false
): void {
  context.tasks.schedule({
    type: 'engineer.photon-forge-heat',
    at,
    payload: {
      skillId: skill.id,
      skillName: skill.name,
      amount,
      persistsOutsideForge
    }
  });
}

/**
 * Schedules a Forge skill's heat at authored animation beats or at completion,
 * preserving committed pulses after interrupts and Corona Burst pulses after Forge exit.
 */
function applyHeat(context: EngineerCastContext, skill: HolosmithSkill): void {
  const state = holosmithState.from(context);
  if (!state.photonForgeActive || !(Number(skill.heatGain) > 0)) return;
  const elapsedMs = Math.max(0, (context.effectiveEnd - context.start) * 1000);
  if (skill.name === 'Corona Burst') {
    const offsets = CORONA_QUICKNESS_PULSE_OFFSETS_MS;
    if (elapsedMs + context.epsilon * 1000 < offsets[0]) return;
    for (const offsetMs of offsets) {
      scheduleHeatPulse(context, skill, context.start + offsetMs / 1000, 2, true);
    }

    return;
  }

  if (skill.name === 'Photon Blitz') {
    for (const offsetMs of PHOTON_BLITZ_PULSE_OFFSETS_MS) {
      if (offsetMs > elapsedMs + context.epsilon * 1000) break;
      scheduleHeatPulse(context, skill, context.start + offsetMs / 1000, 2);
    }

    return;
  }

  if (context.effectiveEnd < context.fullEnd - context.epsilon) {
    const commitMs = Number(skill.interruptCommitMs);
    if (!Number.isFinite(commitMs) || elapsedMs + context.epsilon * 1000 < commitMs) return;
  }

  // A Forge attack that crossed its interrupt commit point already fired; its
  // authored heat survives cancelling the remaining animation/aftercast too.
  scheduleHeatPulse(context, skill, context.effectiveEnd, Number(skill.heatGain));
}

/** Applies a scheduled skill heat pulse, including immediate ECSU threshold payoff and a state snapshot. */
export function handlePhotonForgeHeat(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<PhotonForgeHeatPayload>
): void {
  const state = holosmithState.from(context);
  if (!state.photonForgeActive && task.payload?.persistsOutsideForge !== true) return;
  const previousHeat = state.heat;
  state.heat = Math.min(state.maximumHeat, state.heat + Math.max(0, Number(task.payload?.amount || 0)));
  triggerInstantEnhancedCapacityMight(context, task.at, previousHeat);
  emitStateSnapshot(context, 'engineer', task.at, 'heat', snapshotEngineerState(context.state.profession));
}

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
  if (state.heat === 0) state.overheated = false;
  emitStateSnapshot(context, 'engineer', at, 'vent-exhaust', snapshotEngineerState(context.state.profession));
}

/**
 * Grants Thermal Release Valve's dodge boon and invokes Vent Exhaust when heat may be spent,
 * preserving maximum heat while Photonic Blasting Module awaits its explosion.
 */
export function triggerThermalReleaseValve(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.config, TRAIT.THERMAL_RELEASE_VALVE)) return;
  const state = holosmithState.from(context);
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.THERMAL_RELEASE_VALVE,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Thermal Release Valve — vigor',
    kind: 'vigor',
    duration: gw2SchedulerBoonDuration(
      context,
      skill,
      'vigor',
      engineerBalanceEffectValue(context, PROFILE.thermalReleaseValve, 'boon', 'duration', 3)
    ),
    stacks: engineerBalanceEffectValue(context, PROFILE.thermalReleaseValve, 'boon', 'stacks', 1)
  });
  if (state.heat <= 0 || (hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) && !state.overheated)) return;
  triggerVentExhaust(context, skill, at);
}

/**
 * Holosmith decoration for the Core kit transition. Core equips the kit; the
 * active Holosmith slice owns leaving Photon Forge and its trait payoff.
 * This path skips the Deactivate Photon Forge skill (no heatGain=15) because
 * the player swapped a kit, not pressed the deactivate button.
 */
export function handleHolosmithKitEquip(context: EngineerCastContext, skill: EngineerSkill): void {
  if (skill.handlerId !== 'engineer.kit-equip' || !holosmithState.from(context).photonForgeActive) return;
  const at = context.effectiveEnd;
  holosmithState.from(context).photonForgeActive = false;
  holosmithState.from(context).forgeExitedAt = at;
  startPassiveHeatCadence(context, at);
  grantSolarFocusingLens(context, at, engineerBalanceValue(context, PROFILE.solarFocusingLens, 'minimumStacks', 2));
}

/** Decorates every Holosmith event with heat metadata, then consumes Solar Focusing Lens on eligible strikes. */
export function observeHolosmithScheduledEvent(
  context: EngineerSchedulerContext,
  event: EngineerSimulationEvent
): void {
  decorateHolosmithHeatEvent(context, event);

  if (
    context.config.specialization !== 'Holosmith' ||
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  // Consume a live charge only after packet ownership and activation-window checks pass.
  const state = holosmithState.from(context);
  if (
    Number(state.solarFocusingLensStacks || 0) <= 0 ||
    event.at < Number(state.solarFocusingLensReadyAt || 0) - context.epsilon ||
    event.at > Number(state.solarFocusingLensUntil || 0) + context.epsilon
  )
    return;

  state.solarFocusingLensStacks -= 1;
  context.replaceEvent(event, { solarFocusingLens: true });
  emitSkillCondition(context, {
    cause: event,

    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.SOLAR_FOCUSING_LENS,
    actorType: 'player',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Solar Focusing Lens — Burning',
    condition: 'Burning',
    stacks: engineerBalanceEffectValue(context, PROFILE.solarFocusingLens, 'condition', 'stacks', 1),
    duration: engineerBalanceEffectValue(context, PROFILE.solarFocusingLens, 'condition', 'duration', 3)
  });
}

/** Routes Photon Forge handler IDs to entry, exit, and skill-heat logic. */
export const engineerPhotonForgeSkillHandlers = Object.freeze({
  'engineer.photon-forge-enter': enterPhotonForge,
  'engineer.photon-forge-exit': exitPhotonForge,
  'engineer.heat': applyHeat
});
