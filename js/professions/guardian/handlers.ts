import { guardianCoreSkillHandlers } from "./core/handlers.js";
import { firebrandSkillHandlers } from "./specializations/firebrand/handlers.js";
import { luminarySkillHandlers } from "./specializations/luminary/handlers.js";

/**
 * Application catalog facade. Runtime registries are composed from Core and
 * only the selected elite module.
 */
export const guardianSkillHandlers = Object.freeze(
  Object.fromEntries([
    ...Object.entries(guardianCoreSkillHandlers),
    ...Object.entries(firebrandSkillHandlers),
    ...Object.entries(luminarySkillHandlers),
  ]),
);
