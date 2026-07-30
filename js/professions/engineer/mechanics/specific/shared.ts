import { snapshotEngineerState } from "../../state.js";
import type {
  EngineerSchedulerContext,
  EngineerSkill,
} from "../../types.js";

export function emitEngineerState(
  context: EngineerSchedulerContext,
  at: number,
  reason: string,
): void {
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

export function emitEngineerBarSwap(
  context: EngineerSchedulerContext,
  skill: EngineerSkill,
  at: number,
): void {
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
