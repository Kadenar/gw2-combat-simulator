import type { SimulationEvent } from "../../../platform/engine/types.js";
import type { GuardianSchedulerContext } from "../types.js";

function hasActiveFireField(
  context: GuardianSchedulerContext,
  at: number,
): boolean {
  return context.events.some((event) => {
    if (
      event.type !== "action" ||
      event.cancelled === true ||
      event.skillId == null
    ) {
      return false;
    }
    const skill = context.catalog.skillsById.get(event.skillId);
    const fieldType = String(event.comboField || skill?.comboField || "");
    const startsAt =
      event.comboFieldStartMs == null && skill?.comboFieldStartMs == null
        ? Number(event.endsAt)
        : Number(event.at) +
          Number(event.comboFieldStartMs ?? skill?.comboFieldStartMs) / 1000;
    const duration = Number(
      event.comboFieldDuration ??
        skill?.comboFieldDuration ??
        skill?.duration ??
        0,
    );
    return (
      fieldType.toLowerCase() === "fire" &&
      duration > 0 &&
      startsAt <= at + context.epsilon &&
      startsAt + duration >= at - context.epsilon
    );
  });
}

/** Resolves Guardian whirl finishers through the Guardian's active fire fields. */
export function observeGuardianComboFinisher(
  context: GuardianSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient || 0) > 0) ||
    event.skillId == null
  ) {
    return;
  }
  const skill = context.catalog.skillsById.get(event.skillId);
  const finisherType = String(event.finisherType || skill?.finisherType || "");
  const finisherValue = Number(
    event.finisherValue ?? skill?.finisherValue ?? 0,
  );
  if (
    finisherType.toLowerCase() !== "whirl" ||
    finisherValue <= 0 ||
    !hasActiveFireField(context, Number(event.at))
  ) {
    return;
  }

  for (
    let index = 0;
    index < Math.max(1, Math.floor(finisherValue));
    index += 1
  ) {
    context.emitDerived(event, {
      type: "condition",
      at: Number(event.at),
      source: "guardian",
      sourceId: "guardian.combo.fire-whirl",
      actorType: "player",
      skillId: event.skillId,
      skillName: skill?.name || event.skillName,
      name: `${skill?.name || event.skillName} — Burning Bolt`,
      condition: "Burning",
      stacks: 1,
      duration: 1,
    });
  }
}
