import { snapshotEngineerState } from "../../state.js";

export function emitEngineerState(context, at, reason) {
  context.emit({
    type: "engineer.state",
    at,
    source: "engineer",
    sourceId: `engineer.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotEngineerState(context.state.profession),
  });
}

export function emitEngineerBarSwap(context, skill, at) {
  context.emit({
    type: "sigil_swap",
    at,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
}
