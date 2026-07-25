import { HandlerRegistry } from "./handler-registry.js";
import { createScheduler } from "./scheduler.js";
import { resolveScheduledStream } from "./resolver.js";

/**
 * End-to-end helper that schedules a rotation, resolves the resulting stream,
 * and returns scheduler-facing state alongside the canonical damage result.
 */
export function simulate({
  profession,
  rotation,
  config = {},
  commonHandlers = {},
} = {}) {
  const scheduled = createScheduler({ profession, config }).run(rotation);
  const registry = new HandlerRegistry();
  registry.registerAll(commonHandlers);
  registry.registerAll(profession.eventHandlers);
  const result = resolveScheduledStream({
    stream: scheduled.stream,
    profession,
    handlerRegistry: registry,
    config,
  });
  const endTime = scheduled.state.time;
  const skillName = id =>
    profession.catalog?.skillsById?.get(id)?.name || String(id);
  const cooldowns = Object.fromEntries(
    [...scheduled.state.cooldowns].map(([id, readyAt]) => [
      skillName(id),
      {
        readyAt: Math.round(readyAt * 1000),
        remaining: Math.max(0, Math.round((readyAt - endTime) * 1000)),
      },
    ]),
  );
  const ammo = Object.fromEntries(
    [...scheduled.state.ammo].map(([id, value]) => [
      skillName(id),
      structuredClone(value),
    ]),
  );
  return {
    ...result,
    endState: {
      time: Math.round(endTime * 1000),
      cooldowns,
      ammo,
      activeWeaponSet: scheduled.state.activeWeaponSet,
      profession: structuredClone(result.profession),
    },
    schedulerState: scheduled.state,
    snapshot: scheduled.snapshot,
    warnings: [...scheduled.warnings, ...result.warnings],
  };
}
