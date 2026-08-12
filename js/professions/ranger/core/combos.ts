import { professionCoreState } from "../../../platform/engine/profession.js";
import { createSimulationRandom } from "../../../platform/engine/simulation-random.js";
import type {
  SimulationEvent,
  SimulationRandom,
} from "../../../platform/engine/types.js";
import type { RangerCoreState, RangerSchedulerContext } from "../types.js";

interface ActiveComboField {
  readonly type: string;
}

const PROJECTILE_FINISHER_STREAM = "ranger.projectile-finisher";
const projectileFinisherRandoms = new WeakMap<
  RangerCoreState,
  Readonly<SimulationRandom>
>();

function projectileFinisherRandom(
  context: RangerSchedulerContext,
  state: RangerCoreState,
): Readonly<SimulationRandom> {
  let random = projectileFinisherRandoms.get(state);
  if (!random) {
    random = createSimulationRandom(context.config.randomness);
    projectileFinisherRandoms.set(state, random);
  }
  return random;
}

function activeComboField(
  context: RangerSchedulerContext,
  at: number,
): ActiveComboField | null {
  const fields = context.events
    .filter((event) => {
      if (
        event.type !== "action" ||
        event.cancelled === true ||
        Number(event.endsAt) > at + context.epsilon ||
        event.skillId == null
      ) {
        return false;
      }
      const skill = context.catalog.skillsById.get(event.skillId);
      const startsAt =
        skill?.comboFieldStartMs == null
          ? Number(event.endsAt)
          : Number(event.at) + Number(skill.comboFieldStartMs) / 1000;
      return (
        Boolean(skill?.comboField) &&
        startsAt <= at + context.epsilon &&
        startsAt + Number(skill?.comboFieldDuration ?? skill?.duration ?? 0) >=
          at - context.epsilon
      );
    })
    .sort((left, right) => Number(left.endsAt) - Number(right.endsAt));
  if (!fields.length) return null;
  const skill = context.catalog.skillsById.get(fields[0].skillId!);
  return skill?.comboField ? { type: String(skill.comboField) } : null;
}

/** Resolves Ranger and pet projectile finishers through their active fields. */
export function observeRangerComboFinisher(
  context: RangerSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    !(Number(event.coefficient) > 0) ||
    event.skillId == null
  ) {
    return;
  }
  const skill = context.catalog.skillsById.get(event.skillId);
  if (!skill) return;
  const finisherType = String(event.finisherType || skill.finisherType || "");
  const finisherChance = Number(
    event.finisherValue ?? skill.finisherValue ?? 0,
  );
  if (finisherType.toLowerCase() !== "projectile" || finisherChance <= 0) {
    return;
  }
  const field = activeComboField(context, Number(event.at));
  if (!field || !["Poison", "Ethereal", "Ice"].includes(field.type)) return;

  if (finisherChance < 1) {
    const state = professionCoreState(context);
    const random = projectileFinisherRandom(context, state);
    if (random.stochastic) {
      if (!random.roll(finisherChance, PROJECTILE_FINISHER_STREAM)) return;
    } else {
      state.comboProjectileFinisherProgress += finisherChance;
      if (state.comboProjectileFinisherProgress < 1 - context.epsilon) return;
      state.comboProjectileFinisherProgress -= 1;
    }
  }

  const isPoison = field.type === "Poison";
  const isIce = field.type === "Ice";
  const comboName = isPoison
    ? "Poison Combo"
    : isIce
      ? "Chilling Bolts"
      : "Confusing Bolt";
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: event.source,
    sourceId: `ranger.combo.${field.type.toLowerCase()}-projectile`,
    actorType: event.actorType,
    skillId: event.skillId,
    skillName: skill.name,
    name: `${skill.name} — ${comboName}`,
    condition: isPoison ? "Poisoned" : isIce ? "Chilled" : "Confusion",
    stacks: 1,
    duration: isPoison ? 2 : isIce ? 1 : 5,
  });
}
