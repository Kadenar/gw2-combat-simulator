import {
  emitEngineerBarSwap,
  emitEngineerState,
} from "./shared.js";

function equipKit(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const kit = skill.kitName || skill.name;
  state.activeKit = kit;
  state.photonForgeActive = false;
  state.forgeExitedAt = at;
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
