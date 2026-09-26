import { EPSILON } from '#kernel/core/clock.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitEngineerBarSwap } from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import {
  HOLOSMITH_FORGE_TOGGLE_SKILL_IDS,
  HOLOSMITH_HEAT
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

interface PhotonForgeHeatPayload {
  readonly skillId: string | number;
  readonly skillName: string;
  readonly amount: number;
  readonly persistsOutsideForge: boolean;
}

const PHOTON_FORGE_PASSIVE_HEAT_TASK = 'engineer.photon-forge-passive-heat';
const PHOTON_FORGE_OVERHEAT_PENALTY_TASK = 'engineer.photon-forge-overheat-penalty';

/** Heat observations describe an executed transition; consuming them never restores or mutates profession state. */
function reportHeat(context: EngineerRuntime, reason: string): void {
  const state = holosmithState.from(context);
  emitEngineerEvent(context, 'engineer.heat', {
    at: context.time,
    reason,
    heat: state.heat
  });
}

/** Converts the profiled passive heat rate, including Light Density Amplifier, to one cadence tick. */
function passiveHeatPerTick(context: EngineerRuntime): number {
  const heatProfile = requireBalanceProfileFromContext(context, PROFILE.heat);
  const heatPerSecond =
    balanceProfileNumber(heatProfile, 'energyRegenerationPerSecond') +
    (hasTrait(context.config, TRAIT.LIGHT_DENSITY_AMPLIFIER) ? balanceProfileNumber(heatProfile, 'resourceGain') : 0);

  // Scale profile rates to the resource cadence so 2%/s becomes 0.2% per 100 ms.
  return heatPerSecond * HOLOSMITH_HEAT.heatTickInterval;
}

/** Returns the cooling due on one cadence tick after accounting for Forge state, delay, and PBM. */
function passiveCoolingPerTick(context: EngineerRuntime, at: number): number {
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
function emitEnhancedCapacityMight(context: EngineerRuntime, at: number): void {
  const enhancedCapacityProfile = requireBalanceProfileFromContext(context, PROFILE.enhancedCapacity);
  const boon = requireEffect(enhancedCapacityProfile, 'boon', 'might');
  if (boon) {
    emitEngineerEvent(context, 'buff', {
      at,
      source: 'Trait',
      sourceId: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
      actorType: 'player',
      name: 'Enhanced Capacity Storage Unit — might',
      kind: String(boon.boon).toLowerCase(),
      duration: Number(boon.duration),
      stacks: Number(boon.stacks)
    });
  }
}

/** Emits the first ECSU might pulse immediately when a discrete heat gain crosses the threshold. */
function triggerInstantEnhancedCapacityMight(context: EngineerRuntime, at: number, previousHeat: number): void {
  const state = holosmithState.from(context);
  if (
    !hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) ||
    previousHeat > HOLOSMITH_HEAT.enhancedCapacityThreshold ||
    state.heat <= HOLOSMITH_HEAT.enhancedCapacityThreshold
  )
    return;
  emitEnhancedCapacityMight(context, at);
  const enhancedCapacityProfile = requireBalanceProfileFromContext(context, PROFILE.enhancedCapacity);
  const next = at + balanceProfileNumber(enhancedCapacityProfile, 'pulseInterval');
  state.enhancedCapacityMightAt = next;
  context.schedule('engineer.enhanced-capacity-might', next, undefined, undefined, -200);
}

/** Replaces Solar Focusing Lens charges and opens their profiled activation window. */
function grantSolarFocusingLens(context: EngineerRuntime, at: number, stacks: number): void {
  if (!hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)) return;
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
  // Grants cross into the resolver at their activation time; only impacts spend charges.
  context.emit({
    type: 'engineer.solar-focusing-lens',
    at,
    source: 'Trait',
    sourceId: TRAIT.SOLAR_FOCUSING_LENS,
    actorType: 'player',
    stacks,
    duration: balanceProfileNumber(solarFocusingLensProfile, 'durationMultiplier')
  });
}

// Places every tool-belt skill except the Forge toggle on at least the overheat
// cooldown. A longer existing cooldown wins so overheat never shortens a skill.
function applyToolbeltOverheatPenalty(context: EngineerRuntime, at: number, seconds: number): void {
  for (const skill of context.helpers.skills) {
    if (!skill.toolbeltParentName || HOLOSMITH_FORGE_TOGGLE_SKILL_IDS.has(Number(skill.id))) continue;
    const existingReadyAt = Number(context.cooldowns.get(skill.id) || 0);
    context.cooldownController.setReadyAt(skill.id, Math.max(existingReadyAt, at + seconds));
  }
}

// Schedules the tool-belt penalty with Overheat's delayed damage so skills stay
// usable during the measured 1.56-second window after Overheat begins.
function scheduleToolbeltOverheatPenalty(context: EngineerRuntime, at: number, seconds: number): void {
  context.schedule(PHOTON_FORGE_OVERHEAT_PENALTY_TASK, at, { seconds });
}

/** Emits the delayed strike and burning packets owned by Photonic Blasting Module. */
function emitPhotonicBlastingModuleEffects(context: EngineerRuntime, effectAt: number): void {
  const photonicBlastingModuleProfile = requireBalanceProfileFromContext(context, PROFILE.photonicBlastingModule);
  const strike = requireEffect(photonicBlastingModuleProfile, 'strike', 'Photonic Blasting Module');
  const condition = requireEffect(photonicBlastingModuleProfile, 'condition', 'Burning');
  // The explosion owns the blast finisher and resolves before its same-time condition packet.
  if (strike) {
    emitEngineerEvent(context, 'damage', {
      at: effectAt,
      source: 'Trait',
      sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
      actorType: 'player',
      skillName: 'Photonic Blasting Module',
      name: 'Photonic Blasting Module',
      coefficient: effectNumber(photonicBlastingModuleProfile, strike, 'coefficient'),
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
  }

  // Burning shares the delayed PBM timestamp but remains a separate canonical effect application.
  // Separate Burning applications preserve the total, including any fractional final stack.
  if (condition) {
    const stacks = Number(condition.stacks);
    for (let index = 0; index < Math.ceil(stacks); index += 1) {
      emitEngineerEvent(context, 'condition', {
        at: effectAt,
        source: 'Trait',
        sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
        skillName: 'Photonic Blasting Module',
        name: 'Photonic Blasting Module — Burning',
        condition: String(condition.condition),
        stacks: Math.min(1, stacks - index),
        duration: Number(condition.duration)
      });
    }
  }
}

/** Locks Forge attacks at maximum heat; the rotation owns exit while Overheat consequences remain automatic. */
function forceOverheat(context: EngineerRuntime, at: number): void {
  const state = holosmithState.from(context);
  const photonicBlastingModule = hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE);
  const effectDelay = photonicBlastingModule
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.photonicBlastingModule), 'initialDelay')
    : HOLOSMITH_HEAT.overheatEffectDelay;
  const effectAt = at + effectDelay;
  state.heat = state.maximumHeat;
  state.overheated = true;
  reportHeat(context, 'overheat');
  // Cooling follows the physical Overheat timestamp even while the rotation still owes its bar exit.
  state.forgeExitedAt = at;
  startPassiveHeatCadence(context, at);
  scheduleToolbeltOverheatPenalty(
    context,
    effectAt,
    photonicBlastingModule
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.photonicBlastingModule), 'cooldown')
      : balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.overheat), 'maximumStacks')
  );

  // Publish maximum heat at the overheat timestamp. The module blast and its
  // Solar Focusing Lens charges become active after the observed delay.

  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
  grantSolarFocusingLens(
    context,
    photonicBlastingModule ? effectAt : at,
    balanceProfileNumber(solarFocusingLensProfile, 'maximumStacks')
  );
  if (photonicBlastingModule) emitPhotonicBlastingModuleEffects(context, effectAt);
}

/** Restarts passive heat processing one cadence tick after a Forge state transition. */
function startPassiveHeatCadence(context: EngineerRuntime, at: number): void {
  const state = holosmithState.from(context);
  state.passiveHeatAt = nextPassiveHeatTick(at);
  context.schedule(PHOTON_FORGE_PASSIVE_HEAT_TASK, state.passiveHeatAt, state.passiveHeatAt, undefined, 100);
}

/** Starts cooling cadence for simulations configured with nonzero initial heat. */
export function initializePhotonForgeHeat(context: EngineerRuntime): void {
  const state = holosmithState.from(context);
  if (
    hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) &&
    state.heat > HOLOSMITH_HEAT.enhancedCapacityThreshold
  ) {
    state.enhancedCapacityMightAt = context.time;
    context.schedule('engineer.enhanced-capacity-might', context.time, undefined, undefined, -200);
  }

  // Preheated simulations start the same 100 ms cooling cadence as a Forge exit.
  if (state.heat > EPSILON && state.forgeExitedAt != null) {
    startPassiveHeatCadence(context, Math.max(context.time, state.forgeExitedAt));
  }
}

/** Processes one validated passive heat or cooling tick and schedules the next tick when needed. */
function applyPassiveHeat(context: EngineerRuntime, at: number): void {
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
    reportHeat(context, 'passive-heat');
  }
}

/** Enters Photon Forge, starts heat cadence, and applies entry lockout and trait state. */
export function enterPhotonForge(context: EngineerRuntime, skill: EngineerSkill): void {
  lockTransitionInput(context, 'forgeEntryMs', skill);
  const state = holosmithState.from(context);
  const coreState = professionCoreState(context);
  const at = context.time;
  const heatProfile = requireBalanceProfileFromContext(context, PROFILE.heat);
  const baseKitLockout = balanceProfileNumber(heatProfile, 'cooldown');
  coreState.activeKit = '';
  state.photonForgeActive = true;
  state.forgeExitedAt = null;
  startPassiveHeatCadence(context, at);
  // Photon Forge's kit lockout behaves as recharge, so route its six-second
  // base duration through the shared recharge rules that apply Alacrity.
  state.kitLockoutUntil = at + baseKitLockout / context.cooldownController.rate(skill);
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
  grantSolarFocusingLens(context, at, balanceProfileNumber(solarFocusingLensProfile, 'minimumStacks'));
  emitEngineerBarSwap(context, skill, at);
  reportHeat(context, 'enter-forge');
}

/** Exits Photon Forge voluntarily and starts cooling and exit trait state. */
export function exitPhotonForge(context: EngineerRuntime, skill: EngineerSkill): void {
  lockTransitionInput(context, 'forgeExitMs', skill);
  const state = holosmithState.from(context);
  const at = context.time;
  state.photonForgeActive = false;
  // Overheat already owns its Lens grant; acknowledging its exit must not replace those charges.
  if (!state.overheated) {
    state.forgeExitedAt = at;
    startPassiveHeatCadence(context, at);
    const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
    grantSolarFocusingLens(context, at, balanceProfileNumber(solarFocusingLensProfile, 'minimumStacks'));
  }

  if (state.heat === 0) state.overheated = false;
  emitEngineerBarSwap(context, skill, at);
  reportHeat(context, 'exit-forge');
}

/** Queues a skill-owned heat change, optionally allowing it to land after Forge exit. */
function scheduleHeatPulse(
  context: EngineerRuntime,
  skill: EngineerSkill,
  times: readonly number[],
  amount: number,
  persistsOutsideForge = false
): void {
  for (const at of times)
    context.schedule('engineer.photon-forge-heat', at, {
      skillId: skill.id,
      skillName: skill.name,
      amount,
      persistsOutsideForge
    });
}

/** Allows skill heat only while Photon Forge is active and below Overheat. */
function canApplyHeat(context: EngineerRuntime, skill: HolosmithSkill): boolean {
  const state = holosmithState.from(context);
  return state.photonForgeActive && !state.overheated && Number(skill.heatGain) > 0;
}

// Match Corona Burst heat to its five quickness-scaled damage pulses.
const CORONA_QUICKNESS_PULSE_OFFSETS_MS = Object.freeze([400, 760, 1120, 1480, 1800]);

/** Schedules every committed Corona Burst pulse, including pulses that land after Forge exit. */
export function applyCoronaBurstHeat(context: EngineerRuntime, skill: HolosmithSkill, cast: RuntimeCast): void {
  if (!canApplyHeat(context, skill)) return;
  const elapsedMs = Math.max(0, (cast.effectiveEnd - cast.start) * 1000);
  if (elapsedMs + EPSILON * 1000 < CORONA_QUICKNESS_PULSE_OFFSETS_MS[0]) return;
  const heatPerPulse = Number(skill.heatGain) / CORONA_QUICKNESS_PULSE_OFFSETS_MS.length;
  scheduleHeatPulse(
    context,
    skill,
    CORONA_QUICKNESS_PULSE_OFFSETS_MS.map((offsetMs) => cast.start + offsetMs / 1000),
    heatPerPulse,
    true
  );
}

// Match Photon Blitz heat to projectile launches rather than impacts.
const PHOTON_BLITZ_PULSE_OFFSETS_MS = Object.freeze([240, 400, 480, 640, 720, 880, 960, 1120]);

/** Schedules heat only for Photon Blitz projectiles launched before the channel ends. */
export function applyPhotonBlitzHeat(context: EngineerRuntime, skill: HolosmithSkill, cast: RuntimeCast): void {
  if (!canApplyHeat(context, skill)) return;
  const elapsedMs = Math.max(0, (cast.effectiveEnd - cast.start) * 1000);
  const heatPerPulse = Number(skill.heatGain) / PHOTON_BLITZ_PULSE_OFFSETS_MS.length;
  scheduleHeatPulse(
    context,
    skill,
    PHOTON_BLITZ_PULSE_OFFSETS_MS.filter((offsetMs) => offsetMs <= elapsedMs + EPSILON * 1000).map(
      (offsetMs) => cast.start + offsetMs / 1000
    ),
    heatPerPulse
  );
}

/** Schedules an ordinary Forge attack's heat at completion or its interrupt commit point. */
export function applyHeat(context: EngineerRuntime, skill: HolosmithSkill, cast: RuntimeCast): void {
  if (!canApplyHeat(context, skill)) return;
  const elapsedMs = Math.max(0, (cast.effectiveEnd - cast.start) * 1000);
  if (castWasInterrupted(cast)) {
    const commitMs = Number(skill.interruptCommitMs);
    if (!Number.isFinite(commitMs) || elapsedMs + EPSILON * 1000 < commitMs) return;
  }

  // A Forge attack that crossed its interrupt commit point already fired; its
  // authored heat survives cancelling the remaining animation/aftercast too.
  scheduleHeatPulse(context, skill, [cast.effectiveEnd], Number(skill.heatGain));
}

/** Invokes canonical Vent Exhaust effects and removes its authored heat amount. */
function triggerVentExhaust(context: EngineerRuntime, triggeringSkill: EngineerSkill, at: number): void {
  const ventExhaust: HolosmithSkill | undefined = context.helpers.skillsById.get(ID.VENT_EXHAUST);
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
  const activationId = `engineer.vent-exhaust:${at}`;
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
  reportHeat(context, 'vent-exhaust');
}

/**
 * Grants Thermal Release Valve's dodge boon and invokes Vent Exhaust when heat may be spent,
 * preserving maximum heat while Photonic Blasting Module awaits its explosion.
 */
export function triggerThermalReleaseValve(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.config, TRAIT.THERMAL_RELEASE_VALVE)) return;
  const state = holosmithState.from(context);
  const thermalReleaseValveProfile = requireBalanceProfileFromContext(context, PROFILE.thermalReleaseValve);
  const boon = requireEffect(thermalReleaseValveProfile, 'boon', 'vigor');
  if (boon) {
    emitEngineerEvent(context, 'buff', {
      at,
      source: 'Trait',
      sourceId: TRAIT.THERMAL_RELEASE_VALVE,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thermal Release Valve — vigor',
      kind: String(boon.boon).toLowerCase(),
      duration: Number(boon.duration),
      stacks: Number(boon.stacks)
    });
  }

  if (state.heat <= 0 || (hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) && !state.overheated)) return;
  triggerVentExhaust(context, skill, at);
}

/**
 * Holosmith decoration for the Core kit transition. Core equips the kit; the
 * active Holosmith slice owns leaving Photon Forge and its trait payoff.
 * This path skips the Deactivate Photon Forge skill because the player swapped
 * a kit rather than pressing the deactivate button.
 */
export function handleHolosmithKitEquip(context: EngineerRuntime, skill: EngineerSkill): void {
  const state = holosmithState.from(context);
  if (skill.kitTransition !== 'equip' || !state.photonForgeActive) return;
  const at = context.time;
  lockTransitionInput(context, 'forgeExitMs', skill);
  state.photonForgeActive = false;
  // A kit can acknowledge the exit too, without replacing Overheat's pending Lens grant.
  if (!state.overheated) {
    state.forgeExitedAt = at;
    startPassiveHeatCadence(context, at);
    const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
    grantSolarFocusingLens(context, at, balanceProfileNumber(solarFocusingLensProfile, 'minimumStacks'));
  }

  if (state.heat === 0) state.overheated = false;
  reportHeat(context, 'exit-forge');
}

/** Only a current cadence tick can mutate heat or continue its lifetime. */
export const photonForgeTasks: RuntimeProfession<EngineerRuntimeState>['tasks'] = {
  [PHOTON_FORGE_PASSIVE_HEAT_TASK](context, data) {
    const state = holosmithState.from(context);
    if (state.passiveHeatAt !== data || context.time !== data) return;
    applyPassiveHeat(context, context.time);
    state.heatUpdatedAt = context.time;
    // Overheat can replace the cadence while applying this tick.
    if (state.passiveHeatAt !== data) return;
    const coolingGrace =
      !state.photonForgeActive &&
      state.forgeExitedAt != null &&
      context.time <= state.forgeExitedAt + HOLOSMITH_HEAT.coolingDelay + EPSILON;
    if ((state.photonForgeActive && !state.overheated) || state.heat > EPSILON || coolingGrace)
      startPassiveHeatCadence(context, context.time);
    else state.passiveHeatAt = null;
  },
  'engineer.enhanced-capacity-might'(context) {
    const state = holosmithState.from(context);
    if (state.enhancedCapacityMightAt !== context.time) return;
    state.enhancedCapacityMightAt = Infinity;
    if (state.heat <= HOLOSMITH_HEAT.enhancedCapacityThreshold) return;
    emitEnhancedCapacityMight(context, context.time);
    const interval = balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.enhancedCapacity),
      'pulseInterval'
    );
    if (interval > 0) {
      state.enhancedCapacityMightAt = context.time + interval;
      context.schedule('engineer.enhanced-capacity-might', state.enhancedCapacityMightAt, undefined, undefined, -200);
    }
  },
  'engineer.photon-forge-heat'(context, data) {
    const payload = data as PhotonForgeHeatPayload;
    const state = holosmithState.from(context);
    if (state.overheated || (!state.photonForgeActive && !payload.persistsOutsideForge)) return;
    const previous = state.heat;
    state.heat = grantCapped(state.heat, payload.amount, state.maximumHeat);
    state.heatUpdatedAt = context.time;
    triggerInstantEnhancedCapacityMight(context, context.time, previous);
    reportHeat(context, 'heat');
  },
  [PHOTON_FORGE_OVERHEAT_PENALTY_TASK](context, data) {
    applyToolbeltOverheatPenalty(context, context.time, Math.max(0, Number((data as { seconds: number }).seconds)));
  }
};
