import { reaperState } from "./state.js";
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { createSimulationRandom } from "../../../../platform/engine/simulation-random.js";
import type { SimulationRandom } from "../../../../platform/engine/types.js";
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
  ReaperState,
} from "../../types.js";

const ICE_FIELD_DURATION = 4;

export function executionersScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (event?.type !== "damage" || Number(event.hitIndex || 1) !== 1) return;
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

// Projectile finishers combo once per projectile at the skill's finisherValue
// chance (e.g. Weeping Shots' six bullets, Vicious Shot's one, at 20% each).
// Stochastic mode rolls every projectile separately; deterministic mode banks
// the expected chance and lands a Chilling Bolt whenever a whole bolt accrues.
const PROJECTILE_FINISHER_STREAM = "necromancer.reaper.projectile-finisher";

// One keyed random stream per simulation, tied to the Reaper state object so it
// survives across events without polluting serializable scheduler state.
const projectileFinisherRandoms = new WeakMap<
  ReaperState,
  Readonly<SimulationRandom>
>();

function projectileFinisherRandom(
  context: NecromancerSchedulerContext,
  state: ReaperState,
): Readonly<SimulationRandom> {
  let random = projectileFinisherRandoms.get(state);
  if (!random) {
    random = createSimulationRandom(context.config?.randomness);
    projectileFinisherRandoms.set(state, random);
  }
  return random;
}

function iceFieldActiveAt(
  context: NecromancerSchedulerContext | NecromancerResolverContext,
  at: number,
): boolean {
  if (context.config?.professionAssumptions?.permanentIceField) return true;
  return (
    Number(reaperState.from(context).executionersIceFieldUntil || 0) >=
    at - Number(context.epsilon || 1e-9)
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

function emitResolvedChillingBolt(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillId: number,
): void {
  const skill = context.helpers.skillsById?.get(skillId);
  enqueueOrdered(context.queue, {
    type: "necromancer.chill",
    at: event.at,
    // EVTC attributes the combo condition to the minion's player owner while
    // retaining Bone Shard as the triggering skill.
    source: "necromancer",
    sourceId: skillId,
    actorType: "player",
    skillId,
    skillName: `${skill?.name || event.skillName || "Combo"} — Chilling Bolts`,
    duration: 1,
    triggeredBy: event.skillName,
  });
}

function applyProjectileFinisher(
  state: ReaperState,
  chance: number,
  random: Readonly<SimulationRandom>,
  emit: () => void,
): void {
  if (random.stochastic) {
    if (random.roll(chance, PROJECTILE_FINISHER_STREAM)) emit();
    return;
  }

  let progress = Number(state.projectileFinisherChillProgress || 0) + chance;
  while (progress >= 1) {
    progress -= 1;
    emit();
  }
  state.projectileFinisherChillProgress = progress;
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
    event?.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0)
  )
    return;
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

  const skill = context.catalog.skillsById?.get(skillId);
  const finisherType = event.finisherType || skill?.finisherType;
  const chance = Number(event.finisherValue ?? skill?.finisherValue ?? 0);
  if (
    finisherType !== "Projectile" ||
    !(chance > 0) ||
    !iceFieldActiveAt(context, event.at)
  )
    return;

  const state = reaperState.from(context);
  const random = projectileFinisherRandom(context, state);
  applyProjectileFinisher(state, chance, random, () =>
    emitChillingBolt(context, event, skillId),
  );
}

/**
 * Resolver counterpart for summon damage. Summon attacks are materialized only
 * after their generation guards pass, so resolving the combo here prevents a
 * dead or replaced minion from producing a Chilling Bolt.
 */
export function resolveSummonIceFieldComboFinisher(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "summon" ||
    !(Number(event.coefficient) > 0) ||
    !iceFieldActiveAt(context, event.at)
  )
    return;
  const skillId = Number(event.skillId);
  const skill = context.helpers.skillsById?.get(skillId);
  const finisherType = event.finisherType || skill?.finisherType;
  const chance = Number(event.finisherValue ?? skill?.finisherValue ?? 0);
  if (finisherType !== "Projectile" || !(chance > 0)) return;

  const state = reaperState.from(context);
  applyProjectileFinisher(state, chance, context.random, () =>
    emitResolvedChillingBolt(context, event, skillId),
  );
}
