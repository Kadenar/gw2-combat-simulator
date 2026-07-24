import { HandlerRegistry } from "./handler-registry.js";
import { createScheduler } from "./scheduler.js";
import { resolveScheduledStream } from "./resolver.js";

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
  return {
    ...result,
    schedulerState: scheduled.state,
    snapshot: scheduled.snapshot,
    warnings: [...scheduled.warnings, ...result.warnings],
  };
}
