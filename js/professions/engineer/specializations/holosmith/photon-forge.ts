import { holosmithState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasEngineerTrait } from "../../core/state.js";
import { emitEngineerBarSwap, emitEngineerState } from "../../core/events.js";
import {
  engineerBalanceEffectValue,
  engineerBalanceValue,
} from "../../core/profiles.js";
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";
import {
  HOLOSMITH_CORONA_QUICKNESS_PULSE_OFFSETS_MS,
  HOLOSMITH_HEAT,
  HOLOSMITH_PHOTON_BLITZ_PULSE_OFFSETS_MS,
} from "./mechanics.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill,
  HolosmithState,
} from "../../types.js";

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

const CORONA_QUICKNESS_PULSE_OFFSETS_MS =
  HOLOSMITH_CORONA_QUICKNESS_PULSE_OFFSETS_MS;
const PHOTON_BLITZ_PULSE_OFFSETS_MS = HOLOSMITH_PHOTON_BLITZ_PULSE_OFFSETS_MS;

function passiveHeatRate(context: EngineerSchedulerContext): number {
  return (
    engineerBalanceValue(
      context,
      PROFILE.heat,
      "energyRegenerationPerSecond",
      HOLOSMITH_HEAT.basePassivePerSecond,
    ) +
    (hasEngineerTrait(context.config, TRAIT.LIGHT_DENSITY_AMPLIFIER)
      ? engineerBalanceValue(
          context,
          PROFILE.heat,
          "resourceGain",
          HOLOSMITH_HEAT.lightDensityBonusPerSecond,
        )
      : 0)
  );
}

function enhancedCapacityHeatThreshold(context: unknown): number {
  return engineerBalanceValue(
    context,
    PROFILE.enhancedCapacity,
    "threshold",
    HOLOSMITH_HEAT.enhancedCapacityThreshold,
  );
}

// Records one linear heat segment and advances state.heat.
// When cooling, clamps end time so heat never goes below zero (avoids negative segments).
function appendHeatSegment(
  segments: HeatSegment[],
  state: HolosmithState,
  start: number,
  end: number,
  rate: number,
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
    rate,
  });
  state.heat = Math.max(
    0,
    Math.min(state.maximumHeat, startHeat + (segmentEnd - start) * rate),
  );
}

// Applies passive heat decay while Photon Forge is inactive.
// Cooling schedule after forge exit: 0-3 s flat, 3-8 s at -5/s, 8 s+ at -10/s.
// Photonic Blasting Module suppresses all decay until the overheat has actually fired,
// because the trait holds heat at maximum to enable the delayed explosion.
function coolInactiveForge(
  context: EngineerSchedulerContext,
  target: number,
  segments: HeatSegment[],
): void {
  const state = holosmithState.from(context);
  if (state.photonForgeActive || state.heat <= 0) return;
  const exit = Number(state.forgeExitedAt ?? state.heatUpdatedAt);
  const from = Math.max(Number(state.heatUpdatedAt || 0), exit);
  if (!(target > from)) return;

  if (
    hasEngineerTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) &&
    !state.overheated
  ) {
    appendHeatSegment(segments, state, from, target, 0);
    return;
  }

  const slowStart = exit + 3;
  const fastStart = exit + 8;
  appendHeatSegment(segments, state, from, Math.min(target, slowStart), 0);
  appendHeatSegment(
    segments,
    state,
    Math.max(from, slowStart),
    Math.min(target, fastStart),
    -5,
  );
  appendHeatSegment(segments, state, Math.max(from, fastStart), target, -10);
  if (state.heat <= context.epsilon) {
    state.heat = 0;
    state.overheated = false;
  }
}

function highHeatInterval(
  context: EngineerSchedulerContext,
  segment: HeatSegment,
): HighHeatInterval | null {
  const heatThreshold = enhancedCapacityHeatThreshold(context);
  const endHeat =
    segment.startHeat + (segment.end - segment.start) * segment.rate;
  if (segment.rate > 0) {
    if (endHeat <= heatThreshold) return null;
    return {
      start:
        segment.startHeat > heatThreshold
          ? segment.start
          : segment.start + (heatThreshold - segment.startHeat) / segment.rate,
      end: segment.end,
      endsAbove: true,
    };
  }
  if (segment.rate < 0) {
    if (segment.startHeat <= heatThreshold) return null;
    return {
      start: segment.start,
      end:
        endHeat > heatThreshold
          ? segment.end
          : segment.start + (segment.startHeat - heatThreshold) / -segment.rate,
      endsAbove: endHeat > heatThreshold,
    };
  }
  if (segment.startHeat <= heatThreshold) return null;
  return {
    start: segment.start,
    end: segment.end,
    endsAbove: true,
  };
}

function emitEnhancedCapacityMight(
  context: EngineerSchedulerContext,
  at: number,
): void {
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
    actorType: "player",
    name: "Enhanced Capacity Storage Unit — might",
    kind: "might",
    duration: engineerBalanceEffectValue(
      context,
      PROFILE.enhancedCapacity,
      "boon",
      "duration",
      6,
    ),
    stacks: engineerBalanceEffectValue(
      context,
      PROFILE.enhancedCapacity,
      "boon",
      "stacks",
      2,
    ),
  });
}

// Emits the per-second might pulses from Enhanced Capacity Storage Unit for any
// time spent above the heat threshold within the provided segments.
// readyAt tracks the next eligible emission time across calls so pulses aren't doubled.
function materializeEnhancedCapacityMight(
  context: EngineerSchedulerContext,
  segments: readonly HeatSegment[],
): void {
  if (!hasEngineerTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT))
    return;
  const state = holosmithState.from(context);
  let readyAt = state.enhancedCapacityMightReadyAt;
  for (const segment of segments) {
    const interval = highHeatInterval(context, segment);
    if (!interval) {
      readyAt = null;
      continue;
    }
    if (readyAt == null || Number(readyAt) < interval.start - context.epsilon) {
      readyAt = interval.start;
    }
    while (Number(readyAt) <= interval.end + context.epsilon) {
      emitEnhancedCapacityMight(context, Number(readyAt));
      readyAt =
        Number(readyAt) +
        engineerBalanceValue(
          context,
          PROFILE.enhancedCapacity,
          "pulseInterval",
          1,
        );
    }
    if (!interval.endsAbove) readyAt = null;
  }
  state.enhancedCapacityMightReadyAt = readyAt;
}

function triggerInstantEnhancedCapacityMight(
  context: EngineerSchedulerContext,
  at: number,
  previousHeat: number,
): void {
  const state = holosmithState.from(context);
  if (
    !hasEngineerTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) ||
    previousHeat > enhancedCapacityHeatThreshold(context) ||
    state.heat <= enhancedCapacityHeatThreshold(context)
  )
    return;
  emitEnhancedCapacityMight(context, at);
  state.enhancedCapacityMightReadyAt =
    at +
    engineerBalanceValue(context, PROFILE.enhancedCapacity, "pulseInterval", 1);
}

export function grantSolarFocusingLens(
  context: EngineerSchedulerContext,
  at: number,
  stacks: number,
): void {
  if (!hasEngineerTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)) return;
  const state = holosmithState.from(context);
  state.solarFocusingLensStacks = stacks;
  state.solarFocusingLensReadyAt = at;
  state.solarFocusingLensUntil =
    at +
    engineerBalanceValue(
      context,
      PROFILE.solarFocusingLens,
      "durationMultiplier",
      HOLOSMITH_HEAT.solarFocusingLensDuration,
    );
}

// Extends cooldowns on all toolbelt skills except the forge toggle itself.
// With Photonic Blasting Module the penalty is only 5 s and already-ready skills
// are left alone (penalizeReadySkills=false) to reward the controlled overheat.
function applyToolbeltOverheatPenalty(
  context: EngineerSchedulerContext,
  at: number,
  seconds: number,
  penalizeReadySkills = true,
): void {
  for (const skill of context.catalog.skills) {
    if (
      !skill.toolbeltParentName ||
      skill.name === "Engage Photon Forge" ||
      skill.name.startsWith("Deactivate Photon Forge")
    )
      continue;
    const existingReadyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    if (!penalizeReadySkills && existingReadyAt <= at + context.epsilon)
      continue;
    const currentReadyAt = Math.max(at, existingReadyAt);
    context.state.cooldowns.set(skill.id, currentReadyAt + seconds);
  }
}

function emitOverheatEffects(
  context: EngineerSchedulerContext,
  at: number,
  photonicBlastingModule: boolean,
): void {
  context.emit({
    type: "proc",
    at,
    source: "engineer",
    sourceId: ID.HOLOFORGE_OVERHEATED,
    actorType: "player",
    name: "Overheat",
    procType: "self-damage",
    initialBaseHealthDamage: photonicBlastingModule ? 0 : 3981,
    baseHealthDamageOverTime: 796,
    damageOverTimeDuration: 2.5,
    damageOverTimeInterval: 0.5,
  });
  if (!photonicBlastingModule) return;
  const blastAt =
    at +
    engineerBalanceValue(
      context,
      PROFILE.photonicBlastingModule,
      "initialDelay",
      HOLOSMITH_HEAT.photonicBlastDelay,
    );
  context.emit({
    type: "damage",
    at: blastAt,
    source: "Trait",
    sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
    actorType: "player",
    skillName: "Photonic Blasting Module",
    name: "Photonic Blasting Module",
    coefficient: engineerBalanceEffectValue(
      context,
      PROFILE.photonicBlastingModule,
      "strike",
      "coefficient",
      5,
    ),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    explosion: true,
    comboFinishers: [
      {
        ownerId: "engineer",
        finisherType: "Blast",
        ambiguousFieldSelection: "oldest",
      },
    ],
  });
  context.emit({
    type: "condition",
    at: blastAt,
    source: "Trait",
    sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
    actorType: "player",
    skillName: "Photonic Blasting Module",
    name: "Photonic Blasting Module — Burning",
    condition: "Burning",
    stacks: engineerBalanceEffectValue(
      context,
      PROFILE.photonicBlastingModule,
      "condition",
      "stacks",
      7,
    ),
    duration: engineerBalanceEffectValue(
      context,
      PROFILE.photonicBlastingModule,
      "condition",
      "duration",
      6,
    ),
  });
}

function forceOverheat(context: EngineerSchedulerContext, at: number): void {
  const state = holosmithState.from(context);
  const photonicBlastingModule = hasEngineerTrait(
    context.config,
    TRAIT.PHOTONIC_BLASTING_MODULE,
  );
  state.heat = state.maximumHeat;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  state.overheated = true;
  professionCoreState(context).activeKit = "";
  applyToolbeltOverheatPenalty(
    context,
    at,
    photonicBlastingModule
      ? engineerBalanceValue(
          context,
          PROFILE.photonicBlastingModule,
          "cooldown",
          5,
        )
      : engineerBalanceValue(context, PROFILE.overheat, "maximumStacks", 15),
    !photonicBlastingModule,
  );

  // Publish maximum heat at the overheat timestamp. The module blast and its
  // Solar Focusing Lens charges become active after the observed delay.
  emitEngineerState(context, at, "overheat");
  grantSolarFocusingLens(
    context,
    photonicBlastingModule
      ? at +
          engineerBalanceValue(
            context,
            PROFILE.photonicBlastingModule,
            "initialDelay",
            HOLOSMITH_HEAT.photonicBlastDelay,
          )
      : at,
    engineerBalanceValue(
      context,
      PROFILE.solarFocusingLens,
      "maximumStacks",
      6,
    ),
  );
  emitOverheatEffects(context, at, photonicBlastingModule);
}

export function advancePhotonForgeState(
  context: EngineerSchedulerContext,
  target: number,
): void {
  const state = holosmithState.from(context);
  const from = Number(state.heatUpdatedAt || 0);
  if (target <= from) return;
  const previousHeat = state.heat;
  const previousForgeActive = state.photonForgeActive;
  const previousOverheated = state.overheated;
  const segments: HeatSegment[] = [];

  if (state.photonForgeActive) {
    const rate = passiveHeatRate(context);
    const remaining = state.maximumHeat - state.heat;
    const overheatAt = from + Math.max(0, remaining) / rate;
    if (overheatAt <= target + context.epsilon) {
      appendHeatSegment(segments, state, from, overheatAt, rate);
      forceOverheat(context, overheatAt);
      state.heatUpdatedAt = overheatAt;
      coolInactiveForge(context, target, segments);
    } else {
      appendHeatSegment(segments, state, from, target, rate);
    }
  } else {
    coolInactiveForge(context, target, segments);
  }

  materializeEnhancedCapacityMight(context, segments);
  state.heatUpdatedAt = target;
  if (
    state.heat !== previousHeat ||
    state.photonForgeActive !== previousForgeActive ||
    state.overheated !== previousOverheated
  ) {
    emitEngineerState(context, target, "passive-heat");
  }
}

function enterPhotonForge(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = holosmithState.from(context);
  const coreState = professionCoreState(context);
  const at = context.effectiveEnd;
  coreState.activeKit = "";
  state.photonForgeActive = true;
  state.forgeExitedAt = null;
  state.kitLockoutUntil =
    at + engineerBalanceValue(context, PROFILE.heat, "cooldown", 6);
  grantSolarFocusingLens(
    context,
    at,
    engineerBalanceValue(
      context,
      PROFILE.solarFocusingLens,
      "minimumStacks",
      2,
    ),
  );
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, "enter-forge");
}

function exitPhotonForge(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = holosmithState.from(context);
  const at = context.effectiveEnd;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  grantSolarFocusingLens(
    context,
    at,
    engineerBalanceValue(
      context,
      PROFILE.solarFocusingLens,
      "minimumStacks",
      2,
    ),
  );
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, "exit-forge");
}

function scheduleHeatPulse(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
  amount: number,
  persistsOutsideForge = false,
): void {
  context.tasks.schedule({
    type: "engineer.photon-forge-heat",
    at,
    payload: {
      skillId: skill.id,
      skillName: skill.name,
      amount,
      persistsOutsideForge,
    },
  });
}

// Schedules heat pulse tasks for the completed cast.
// Corona Burst and Photon Blitz pulse heat at each animation beat rather than
// once at the end; Corona Burst pulses are flagged persistsOutsideForge=true
// because they can resolve after the player has already exited the forge.
// Most skills only grant heat on full completion (effectiveEnd === fullEnd).
function applyHeat(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = holosmithState.from(context);
  if (!state.photonForgeActive || !(Number(skill.heatGain) > 0)) return;
  const elapsedMs = Math.max(0, (context.effectiveEnd - context.start) * 1000);
  if (skill.name === "Corona Burst") {
    const offsets = CORONA_QUICKNESS_PULSE_OFFSETS_MS;
    if (elapsedMs + context.epsilon * 1000 < offsets[0]) return;
    for (const offsetMs of offsets) {
      scheduleHeatPulse(
        context,
        skill,
        context.start + offsetMs / 1000,
        2,
        true,
      );
    }
    return;
  }
  if (skill.name === "Photon Blitz") {
    for (const offsetMs of PHOTON_BLITZ_PULSE_OFFSETS_MS) {
      if (offsetMs > elapsedMs + context.epsilon * 1000) break;
      scheduleHeatPulse(context, skill, context.start + offsetMs / 1000, 2);
    }
    return;
  }
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  scheduleHeatPulse(
    context,
    skill,
    context.effectiveEnd,
    Number(skill.heatGain),
  );
}

export function handlePhotonForgeHeat(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<PhotonForgeHeatPayload>,
): void {
  const state = holosmithState.from(context);
  if (!state.photonForgeActive && task.payload?.persistsOutsideForge !== true)
    return;
  const previousHeat = state.heat;
  state.heat = Math.min(
    state.maximumHeat,
    state.heat + Math.max(0, Number(task.payload?.amount || 0)),
  );
  triggerInstantEnhancedCapacityMight(context, task.at, previousHeat);
  if (state.photonForgeActive && state.heat >= state.maximumHeat) {
    forceOverheat(context, task.at);
  } else {
    emitEngineerState(context, task.at, "heat");
  }
}

// Vigor is granted unconditionally on dodge; Vent Exhaust fires only when heat > 0.
// Photonic Blasting Module suppresses Vent Exhaust while holding heat before the
// explosion fires (overheated=false), because the heat must stay at max for PBM.
export function triggerThermalReleaseValve(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
  if (!hasEngineerTrait(context.config, TRAIT.THERMAL_RELEASE_VALVE)) return;
  const state = holosmithState.from(context);
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: TRAIT.THERMAL_RELEASE_VALVE,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Thermal Release Valve — vigor",
    kind: "vigor",
    duration: engineerBalanceEffectValue(
      context,
      PROFILE.thermalReleaseValve,
      "boon",
      "duration",
      3,
    ),
    stacks: engineerBalanceEffectValue(
      context,
      PROFILE.thermalReleaseValve,
      "boon",
      "stacks",
      1,
    ),
  });
  if (
    state.heat <= 0 ||
    (hasEngineerTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) &&
      !state.overheated)
  )
    return;

  context.emit({
    type: "damage",
    at,
    source: "Trait",
    sourceId: TRAIT.THERMAL_RELEASE_VALVE,
    actorType: "player",
    skillId: ID.VENT_EXHAUST,
    skillName: "Vent Exhaust",
    name: "Vent Exhaust",
    coefficient: engineerBalanceEffectValue(
      context,
      PROFILE.thermalReleaseValve,
      "strike",
      "coefficient",
      1.1,
    ),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    noCrit: true,
    triggeredBy: skill.name,
  });
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId: TRAIT.THERMAL_RELEASE_VALVE,
    actorType: "player",
    skillId: ID.VENT_EXHAUST,
    skillName: "Vent Exhaust",
    name: "Vent Exhaust — Burning",
    condition: "Burning",
    stacks: engineerBalanceEffectValue(
      context,
      PROFILE.thermalReleaseValve,
      "condition",
      "stacks",
      2,
    ),
    duration: engineerBalanceEffectValue(
      context,
      PROFILE.thermalReleaseValve,
      "condition",
      "duration",
      6,
    ),
    triggeredBy: skill.name,
  });
  state.heat = Math.max(
    0,
    state.heat -
      engineerBalanceValue(
        context,
        PROFILE.thermalReleaseValve,
        "resourceCost",
        15,
      ),
  );
  state.heatUpdatedAt = at;
  if (state.heat === 0) state.overheated = false;
  emitEngineerState(context, at, "thermal-release-valve");
}

/**
 * Holosmith decoration for the Core kit transition. Core equips the kit; the
 * active Holosmith slice owns leaving Photon Forge and its trait payoff.
 */
/**
 * Holosmith decoration for the Core kit transition. Core equips the kit; the
 * active Holosmith slice owns leaving Photon Forge and its trait payoff.
 * This path skips the Deactivate Photon Forge skill (no heatGain=15) because
 * the player swapped a kit, not pressed the deactivate button.
 */
export function handleHolosmithKitEquip(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  if (
    skill.handlerId !== "engineer.kit-equip" ||
    !holosmithState.from(context).photonForgeActive
  )
    return;
  const at = context.effectiveEnd;
  holosmithState.from(context).photonForgeActive = false;
  holosmithState.from(context).forgeExitedAt = at;
  grantSolarFocusingLens(
    context,
    at,
    engineerBalanceValue(
      context,
      PROFILE.solarFocusingLens,
      "minimumStacks",
      2,
    ),
  );
}

// Called for every scheduled event. Radiant Arc and Refraction Cutter routing
// runs regardless of specialization so that Amalgam (which delegates here) also
// benefits. Solar Focusing Lens stack consumption is Holosmith-only.
export function observeHolosmithScheduledEvent(
  context: EngineerSchedulerContext,
  event: EngineerSimulationEvent,
): void {
  if (
    event.type === "engineer.radiant-arc-quickness" ||
    event.type === "engineer.refraction-cutter-extra-blades"
  ) {
    const heat = Number(holosmithState.from(context).heat || 0);
    const enhancedCapacityTier =
      heat >= enhancedCapacityHeatThreshold(context) &&
      hasEngineerTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
    if (event.type === "engineer.radiant-arc-quickness") {
      context.replaceEvent(event, {
        duration: enhancedCapacityTier
          ? 6
          : heat > engineerBalanceValue(context, PROFILE.heat, "threshold", 50)
            ? 4
            : 2,
      });
    } else {
      context.replaceEvent(event, {
        extraBlades: enhancedCapacityTier
          ? 4
          : heat > engineerBalanceValue(context, PROFILE.heat, "threshold", 50)
            ? 2
            : 0,
      });
    }
    return;
  }
  if (
    context.config.specialization !== "Holosmith" ||
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    !hasEngineerTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  const state = holosmithState.from(context);
  if (
    Number(state.solarFocusingLensStacks || 0) <= 0 ||
    event.at < Number(state.solarFocusingLensReadyAt || 0) - context.epsilon ||
    event.at > Number(state.solarFocusingLensUntil || 0) + context.epsilon
  )
    return;

  state.solarFocusingLensStacks -= 1;
  context.replaceEvent(event, { solarFocusingLens: true });
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.SOLAR_FOCUSING_LENS,
    actorType: "player",
    skillId: event.skillId,
    skillName: event.skillName,
    name: "Solar Focusing Lens — Burning",
    condition: "Burning",
    stacks: engineerBalanceEffectValue(
      context,
      PROFILE.solarFocusingLens,
      "condition",
      "stacks",
      1,
    ),
    duration: engineerBalanceEffectValue(
      context,
      PROFILE.solarFocusingLens,
      "condition",
      "duration",
      3,
    ),
  });
}

export const engineerPhotonForgeSkillHandlers = Object.freeze({
  "engineer.photon-forge-enter": enterPhotonForge,
  "engineer.photon-forge-exit": exitPhotonForge,
  "engineer.heat": applyHeat,
});
