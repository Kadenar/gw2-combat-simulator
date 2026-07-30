import type {
  EngineerSchedulerContext,
  EngineerSimulationEvent,
} from "../../types.js";

function activeComboField(
  context: EngineerSchedulerContext,
  type: string,
  at: number,
): boolean {
  return context.events.some(event => {
    if (
      event.type !== "action"
      || event.cancelled === true
      || Number(event.endsAt) > at + context.epsilon
    ) return false;
    if (event.skillId == null) return false;
    const field = context.catalog.skillsById.get(event.skillId);
    return (
      (!type || field?.comboField === type)
      && field?.comboField
      && Number(event.endsAt) + Number(field.duration || 0)
        >= at - context.epsilon
    );
  });
}

/**
 * Resolves damaging projectile finishers through the Engineer's own fields.
 * One scheduled damage packet represents one projectile connection.
 */
export function observeEngineerComboFinisher(
  context: EngineerSchedulerContext,
  event: EngineerSimulationEvent,
): void {
  if (event.type === "action" && event.cancelled !== true) {
    if (event.skillId == null) return;
    const field = context.catalog.skillsById.get(event.skillId);
    const duration = Number(field?.duration || 0);
    if (field?.comboField && duration > 0) {
      const startsAt = Number(event.endsAt);
      context.emitDerived(event, {
        type: "engineer.combo-field",
        at: startsAt,
        source: "engineer",
        sourceId: event.skillId,
        actorType: "player",
        skillId: event.skillId,
        skillName: field.name,
        fieldType: field.comboField,
        expiresAt: startsAt + duration,
      });
    }
    return;
  }
  if (
    event.type !== "damage"
    || event.actorType !== "player"
    || !(Number(event.coefficient) > 0)
  ) return;
  if (event.skillId == null) return;
  const skill = context.catalog.skillsById.get(event.skillId);
  if (!skill) return;
  const finisherType = event.finisherType || skill?.finisherType;
  const finisherChance = Number(
    event.finisherValue ?? skill?.finisherValue ?? 0,
  );
  if (
    finisherType !== "Projectile"
    || finisherChance <= 0
    || !activeComboField(context, "Fire", event.at)
  ) return;
  if (finisherChance < 1) {
    const state = context.state.profession;
    state.fireProjectileFinisherProgress =
      Number(state.fireProjectileFinisherProgress || 0) + finisherChance;
    if (state.fireProjectileFinisherProgress < 1 - context.epsilon) return;
    state.fireProjectileFinisherProgress -= 1;
  }

  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "engineer",
    sourceId: "engineer.combo.fire-projectile",
    actorType: "player",
    skillId: event.skillId,
    skillName: skill.name,
    name: `${skill.name} — Burning Bolt`,
    condition: "Burning",
    stacks: 1,
    duration: 1,
  });
}
