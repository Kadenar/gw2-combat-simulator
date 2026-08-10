import { reaperState } from "./state.js";
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../../types.js";

const ICE_FIELD_DURATION = 4;

export function executionersScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (
    event?.type !== "damage"
    || Number(event.hitIndex || 1) !== 1
  ) return;
  reaperState.from(context).executionersIceFieldUntil =
    event.at + ICE_FIELD_DURATION;
}

// Whirl finishers pulse one guaranteed bolt per count, so each bolt applies a
// 1s Chilling Bolt while standing in an ice field. Counts match the in-game
// whirl-finisher pulses for each skill.
const WHIRL_FINISHER_BOLTS: ReadonlyMap<number, number> = new Map([
  [ID.SOUL_SPIRAL, 4],
  [ID.GRAVEDIGGER, 3],
  [ID.DEATH_SPIRAL, 2],
  [ID.EXTIRPATE, 3],
]);

// Projectile finishers combo per projectile at a fixed chance. Deterministically
// this banks that chance per projectile and lands a Chilling Bolt whenever a
// whole bolt accumulates (e.g. Weeping Shots' six projectiles at 20% each).
const PROJECTILE_FINISHER_CHANCE: ReadonlyMap<number, number> = new Map([
  [ID.WEEPING_SHOTS, 0.2],
]);

function iceFieldActiveAt(
  context: NecromancerSchedulerContext,
  at: number,
): boolean {
  if (context.config?.professionAssumptions?.permanentIceField) return true;
  return (
    Number(reaperState.from(context).executionersIceFieldUntil || 0)
      >= at - context.epsilon
  );
}

function emitChillingBolt(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
  skillId: number,
): void {
  const skill = context.catalog.skillsById?.get(skillId);
  context.emit({
    type: "necromancer.chill",
    at: event.at,
    source: "necromancer",
    sourceId: skillId,
    actorType: "player",
    skillId,
    skillName: `${skill?.name || event.skillName || "Combo"} — Chilling Bolts`,
    duration: 1,
  });
}

/**
 * Scheduler observation hook that turns Reaper's combo finishers into Chilling
 * Bolts while an ice field is present (Executioner's Scythe or the permanent
 * ice-field testing toggle).
 */
export function iceFieldComboFinishers(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
): void {
  if (
    event?.type !== "damage"
    || event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
  ) return;
  const skillId = Number(event.skillId);

  const bolts = WHIRL_FINISHER_BOLTS.get(skillId);
  if (bolts != null) {
    // Whirl bolts fire once per cast; anchor them to the opening hit.
    if (Number(event.hitIndex || 1) !== 1) return;
    if (!iceFieldActiveAt(context, event.at)) return;
    for (let index = 0; index < bolts; index += 1) {
      emitChillingBolt(context, event, skillId);
    }
    return;
  }

  const chance = PROJECTILE_FINISHER_CHANCE.get(skillId);
  if (chance == null || !iceFieldActiveAt(context, event.at)) return;
  const state = reaperState.from(context);
  let progress = Number(state.projectileFinisherChillProgress || 0) + chance;
  while (progress >= 1) {
    progress -= 1;
    emitChillingBolt(context, event, skillId);
  }
  state.projectileFinisherChillProgress = progress;
}
