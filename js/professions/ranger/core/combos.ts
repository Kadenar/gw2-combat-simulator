import { professionCoreState } from "../../../platform/engine/profession.js";
import type { SimulationEvent } from "../../../platform/engine/types.js";
import type { RangerSchedulerContext } from "../types.js";

interface ActiveComboField {
  readonly type: string;
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
      return (
        Boolean(skill?.comboField) &&
        Number(event.endsAt) + Number(skill?.duration || 0) >=
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
  if (!field || !["Poison", "Ethereal"].includes(field.type)) return;

  if (finisherChance < 1) {
    const state = professionCoreState(context);
    state.comboProjectileFinisherProgress += finisherChance;
    if (state.comboProjectileFinisherProgress < 1 - context.epsilon) return;
    state.comboProjectileFinisherProgress -= 1;
  }

  const isPoison = field.type === "Poison";
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: event.source,
    sourceId: `ranger.combo.${field.type.toLowerCase()}-projectile`,
    actorType: event.actorType,
    skillId: event.skillId,
    skillName: skill.name,
    name: `${skill.name} — ${isPoison ? "Poison Combo" : "Confusing Bolt"}`,
    condition: isPoison ? "Poisoned" : "Confusion",
    stacks: 1,
    duration: isPoison ? 2 : 5,
  });
}
