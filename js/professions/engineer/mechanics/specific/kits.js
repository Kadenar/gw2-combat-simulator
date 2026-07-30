import {
  emitEngineerBarSwap,
  emitEngineerState,
} from "./shared.js";
import { grantSolarFocusingLens } from "./photon-forge.js";

function equipKit(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const kit = skill.kitName || skill.name;
  const leftPhotonForge = state.photonForgeActive;
  state.activeKit = kit;
  state.photonForgeActive = false;
  if (leftPhotonForge) {
    state.forgeExitedAt = at;
    grantSolarFocusingLens(context, at, 2);
  }
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, "equip-kit");
}

function stowKit(context, skill) {
  const at = context.effectiveEnd;
  context.state.profession.activeKit = "";
  emitEngineerBarSwap(context, skill, at);
  emitEngineerState(context, at, "stow-kit");
}

export const engineerKitSkillHandlers = Object.freeze({
  "engineer.kit-equip": equipKit,
  "engineer.kit-stow": stowKit,
});
