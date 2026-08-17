import type {
  SchedulerRecord,
  SimulationEventInput,
} from "../../../platform/engine/types.js";
import type { ElementalistSchedulerContext } from "../types.js";

export function prepareElementalistHitboxEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEventInput,
): SimulationEventInput {
  const skill =
    context.catalog.skillsById.get(event.skillId ?? event.sourceId) ||
    context.catalog.skillsByName.get(String(event.skillName || event.name));
  const preparedEvent =
    skill?.overload &&
    String(event.skillName || event.name || "") === skill.name
      ? { ...event, skillWeapon: "Profession mechanic" }
      : event;
  const professionAssumptions = (context.config.professionAssumptions ||
    {}) as SchedulerRecord;
  const hitboxSize = String(
    professionAssumptions.hitboxSize || context.config.hitboxSize || "small",
  );
  if (hitboxSize !== "small") return preparedEvent;
  const hitIndex = Number(preparedEvent.hitboxIndex || 0);
  const smallHitboxCap = Number(preparedEvent.smallHitboxCap || 0);
  const excluded =
    preparedEvent.largeHitboxOnly === true ||
    (smallHitboxCap > 0 && hitIndex > smallHitboxCap);
  if (!excluded) return preparedEvent;
  return {
    ...preparedEvent,
    type: "marker",
    name: `${String(preparedEvent.skillName || preparedEvent.name || "Elementalist effect")} misses small hitbox`,
    cancelled: true,
    detail: "excluded by Elementalist target-hitbox rules",
    elementalistHitboxExcluded: true,
  };
}
