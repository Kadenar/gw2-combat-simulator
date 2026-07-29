import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../state.js";
import {
  emitEngineerBarSwap,
  emitEngineerState,
} from "./shared.js";

function coolInactiveForge(state, target) {
  if (state.photonForgeActive || state.heat <= 0) return;
  const exit = Number(state.forgeExitedAt ?? state.heatUpdatedAt);
  const from = Math.max(Number(state.heatUpdatedAt || 0), exit);
  const slowStart = exit + 3;
  const fastStart = exit + 8;
  const integrate = (start, end, rate) => {
    if (end > start) state.heat -= (end - start) * rate;
  };
  integrate(Math.max(from, slowStart), Math.min(target, fastStart), 5);
  integrate(Math.max(from, fastStart), target, 10);
  state.heat = Math.max(0, state.heat);
  if (state.heat === 0) state.overheated = false;
}

function forceOverheat(context, at) {
  const state = context.state.profession;
  state.heat = state.maximumHeat;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  state.overheated = true;
  state.activeKit = "";
  const toolbeltPenalty = hasEngineerTrait(
    context.config,
    TRAIT.PHOTONIC_BLASTING_MODULE,
  ) ? 5 : 15;
  for (const skill of context.catalog.skills) {
    if (!skill.toolbeltParentName) continue;
    context.state.cooldowns.set(
      skill.id,
      Math.max(
        Number(context.state.cooldowns.get(skill.id) || 0),
        at + toolbeltPenalty,
      ),
    );
  }
  emitEngineerState(context, at, "overheat");
}

export function advancePhotonForgeState(context, target) {
  const state = context.state.profession;
  const from = Number(state.heatUpdatedAt || 0);
  if (target <= from) return;
  const previousHeat = state.heat;
  const previousForgeActive = state.photonForgeActive;
  const previousOverheated = state.overheated;
  if (state.photonForgeActive) {
    const remaining = state.maximumHeat - state.heat;
    const overheatAt = from + Math.max(0, remaining) / 2;
    if (overheatAt <= target) {
      forceOverheat(context, overheatAt);
      state.heatUpdatedAt = overheatAt;
      coolInactiveForge(state, target);
    } else {
      state.heat += (target - from) * 2;
    }
  } else {
    coolInactiveForge(state, target);
  }
  state.heatUpdatedAt = target;
  if (
    state.heat !== previousHeat
    || state.photonForgeActive !== previousForgeActive
    || state.overheated !== previousOverheated
  ) {
    emitEngineerState(context, target, "passive-heat");
  }
}

function enterPhotonForge(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.activeKit = "";
  state.photonForgeActive = true;
  state.forgeExitedAt = null;
  state.kitLockoutUntil = at + 6;
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, "enter-forge");
}

function exitPhotonForge(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, "exit-forge");
}

function applyHeat(context, skill) {
  const state = context.state.profession;
  if (!state.photonForgeActive || !(Number(skill.heatGain) > 0)) return;
  const at = context.effectiveEnd;
  state.heat = Math.min(
    state.maximumHeat,
    state.heat + Number(skill.heatGain),
  );
  if (state.heat >= state.maximumHeat) forceOverheat(context, at);
  else emitEngineerState(context, at, "heat");
}

export const engineerPhotonForgeSkillHandlers = Object.freeze({
  "engineer.photon-forge-enter": enterPhotonForge,
  "engineer.photon-forge-exit": exitPhotonForge,
  "engineer.heat": applyHeat,
});
