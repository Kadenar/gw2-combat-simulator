import { professionSpecializationState } from "../../../../platform/engine/profession.js";
import type {
  NecromancerCastContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../../types.js";

export function executionersScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (
    event?.type !== "damage"
    || Number(event.hitIndex || 1) !== 1
  ) return;
  professionSpecializationState(context, "Reaper").executionersIceFieldUntil = event.at + 4;
}

const SOUL_SPIRAL_ICE_COMBO_HITS = new Set([2, 4, 6, 8, 10, 11, 12]);

export function soulSpiral(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (
    event?.type !== "damage"
    || !SOUL_SPIRAL_ICE_COMBO_HITS.has(Number(event.hitIndex || 1))
    || Number(professionSpecializationState(context, "Reaper").executionersIceFieldUntil || 0)
      < event.at - context.epsilon
  ) return;
  context.emit({
    type: "necromancer.chill",
    at: event.at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: `${skill.name} — Chilling Bolts`,
    duration: 1,
  });
}
